import type { Deps } from "@/services/shared";
import { firstName, getProjectOrThrow, usersWithPerm } from "@/services/shared";
import type { Payment } from "@/schemas/entities";
import { PaymentCreateInput, PaymentUpdateInput } from "@/schemas/inputs";
import { parse } from "@/utils/validate";
import { requirePerm, type Actor } from "@/utils/rbac";
import { invalid, notFound } from "@/utils/errors";
import { csv, matchesText, today } from "@/utils/query";
import { formatMoney } from "@/utils/format";
import { effectivePaymentStatus, receivedOf } from "@/modules/projects/finance";

export interface PaymentFilter { projectId?: string; clientId?: string; status?: string[]; q?: string; includeDeleted?: boolean; onlyDeleted?: boolean }
export const paymentFilterFromParams = (sp: URLSearchParams): PaymentFilter => ({
  projectId: sp.get("projectId") ?? undefined,
  clientId: sp.get("clientId") ?? undefined,
  status: csv(sp.get("status")),
  q: sp.get("q") ?? undefined,
  onlyDeleted: sp.get("deleted") === "true" ? true : undefined,
});

export type PaymentView = Payment & { effectiveStatus: Payment["status"]; outstanding: number };

export class PaymentService {
  constructor(private d: Deps) {}

  private view(p: Payment): PaymentView {
    return { ...p, effectiveStatus: effectivePaymentStatus(p), outstanding: p.status === "CANCELLED" ? 0 : Math.max(p.amount - receivedOf(p), 0) };
  }

  async list(actor: Actor, f: PaymentFilter = {}): Promise<PaymentView[]> {
    requirePerm(actor, "finance:view");
    const projects = new Map((await this.d.repos.projects.findAll()).map((p) => [p.id, p]));
    return (await this.d.repos.payments.findAll())
      .filter((p) => {
        if (f.onlyDeleted ? !p.isDeleted : !f.includeDeleted && p.isDeleted) return false;
        if (!f.onlyDeleted && projects.get(p.projectId)?.isDeleted) return false;
        const eff = effectivePaymentStatus(p);
        return (
          (!f.projectId || p.projectId === f.projectId) && (!f.clientId || p.clientId === f.clientId) &&
          (!f.status?.length || f.status.includes(eff) || f.status.includes(p.status)) &&
          matchesText(f.q, p.invoiceNumber, p.notes, p.id)
        );
      })
      .map((p) => this.view(p))
      .sort((a, b) => (b.paymentDate ?? b.dueDate ?? b.createdAt).localeCompare(a.paymentDate ?? a.dueDate ?? a.createdAt));
  }

  async get(actor: Actor, id: string) {
    requirePerm(actor, "finance:view");
    const p = await this.d.repos.payments.findById(id);
    if (!p) throw notFound("Payment");
    return this.view(p);
  }

  /** Make status/receivedAmount/paymentDate coherent. */
  private normalize(p: Pick<Payment, "status" | "amount" | "receivedAmount" | "paymentDate">) {
    const out = { status: p.status, receivedAmount: p.receivedAmount, paymentDate: p.paymentDate };
    if (p.receivedAmount > p.amount) throw invalid("Received amount cannot exceed the invoice amount.");
    if (p.status === "PAID") {
      out.receivedAmount = p.amount;
      out.paymentDate = p.paymentDate ?? today();
    } else if (p.status === "PARTIALLY_PAID") {
      if (!(p.receivedAmount > 0 && p.receivedAmount < p.amount)) {
        throw invalid("For a partially paid invoice, received amount must be above 0 and below the invoice amount.");
      }
      out.paymentDate = p.paymentDate ?? today();
    } else if (p.status === "PENDING" || p.status === "OVERDUE") {
      if (p.receivedAmount > 0) throw invalid("Use 'Partially Paid' when some amount has been received.");
    }
    return out;
  }

  async create(actor: Actor, raw: unknown) {
    requirePerm(actor, "payment:write");
    const input = parse(PaymentCreateInput, raw);
    const project = await getProjectOrThrow(this.d.repos, input.projectId);
    const dup = (await this.d.repos.payments.findAll()).find(
      (p) => !p.isDeleted && p.invoiceNumber.toLowerCase() === input.invoiceNumber.toLowerCase(),
    );
    if (dup) throw invalid(`Invoice number ${input.invoiceNumber} is already used (${dup.id}).`);
    const norm = this.normalize({ ...input, paymentDate: input.paymentDate ?? null });
    const p = await this.d.repos.payments.create({
      ...input, ...norm, clientId: project.clientId, dueDate: input.dueDate ?? null, paymentMethod: input.paymentMethod ?? null,
      createdBy: actor.id, isDeleted: false, deletedAt: null, deletedBy: null,
    });
    await this.d.activity.log({
      entityType: "PAYMENT", entityId: p.id, projectId: p.projectId, action: "PAYMENT_ADDED", userId: actor.id,
      newValue: { amount: p.amount, status: p.status },
      message: `${actor.name} added payment ${p.invoiceNumber} for ${formatMoney(p.amount, p.currency)} (${p.status.toLowerCase().replace("_", " ")})`,
    });
    await this.notifyStatus(actor, p, project.name, null);
    return this.view(p);
  }

  async update(actor: Actor, id: string, raw: unknown) {
    requirePerm(actor, "payment:write");
    const before = await this.d.repos.payments.findById(id);
    if (!before || before.isDeleted) throw notFound("Payment");
    const patch = parse(PaymentUpdateInput, raw);
    if (patch.invoiceNumber && patch.invoiceNumber.toLowerCase() !== before.invoiceNumber.toLowerCase()) {
      const dup = (await this.d.repos.payments.findAll()).find(
        (p) => p.id !== id && !p.isDeleted && p.invoiceNumber.toLowerCase() === patch.invoiceNumber!.toLowerCase(),
      );
      if (dup) throw invalid(`Invoice number ${patch.invoiceNumber} is already used (${dup.id}).`);
    }
    const clean: Partial<Payment> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) (clean as Record<string, unknown>)[k] = v;
    const merged = { ...before, ...clean };
    // moving back from PAID/PARTIAL to PENDING resets the received amount unless given explicitly
    if (clean.status && ["PENDING", "OVERDUE", "CANCELLED"].includes(clean.status) && patch.receivedAmount === undefined) merged.receivedAmount = 0;
    if (clean.status === "PARTIALLY_PAID" && patch.receivedAmount === undefined) merged.receivedAmount = before.receivedAmount;
    const norm = clean.status === "CANCELLED" ? { status: "CANCELLED" as const, receivedAmount: 0, paymentDate: merged.paymentDate } : this.normalize(merged);
    const after = await this.d.repos.payments.update(id, { ...clean, ...norm });
    const project = await this.d.repos.projects.findById(after.projectId);
    await this.d.activity.log({
      entityType: "PAYMENT", entityId: id, projectId: after.projectId,
      action: before.status !== after.status ? "STATUS_CHANGED" : "UPDATED", userId: actor.id,
      oldValue: before.status, newValue: after.status,
      message: before.status !== after.status
        ? `${actor.name} changed payment ${after.invoiceNumber} from ${before.status} → ${after.status}`
        : `${actor.name} updated payment ${after.invoiceNumber}`,
    });
    if (before.status !== after.status) await this.notifyStatus(actor, after, project?.name ?? after.projectId, before.status);
    return this.view(after);
  }

  async softDelete(actor: Actor, id: string) {
    requirePerm(actor, "payment:write");
    const p = await this.d.repos.payments.findById(id);
    if (!p || p.isDeleted) throw notFound("Payment");
    await this.d.repos.payments.update(id, { isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: actor.id });
    await this.d.activity.log({
      entityType: "PAYMENT", entityId: id, projectId: p.projectId, action: "DELETED", userId: actor.id,
      message: `${actor.name} deleted payment ${p.invoiceNumber}`,
    });
  }

  async restore(actor: Actor, id: string) {
    requirePerm(actor, "payment:write");
    const p = await this.d.repos.payments.findById(id);
    if (!p || !p.isDeleted) throw notFound("Payment");
    const after = await this.d.repos.payments.update(id, { isDeleted: false, deletedAt: null, deletedBy: null });
    await this.d.activity.log({
      entityType: "PAYMENT", entityId: id, projectId: p.projectId, action: "RESTORED", userId: actor.id,
      message: `${actor.name} restored payment ${p.invoiceNumber}`,
    });
    return this.view(after);
  }

  private async notifyStatus(actor: Actor, p: Payment, projectName: string, prev: Payment["status"] | null) {
    const audience = (await usersWithPerm(this.d.repos, "finance:view")).map((u) => u.id);
    const project = await this.d.repos.projects.findById(p.projectId);
    const to = [...audience, project?.projectManagerId];
    if (p.status === "PAID" || p.status === "PARTIALLY_PAID") {
      await this.d.notifications.notify({
        userIds: to, excludeUserId: actor.id, type: "PAYMENT_RECEIVED", severity: "SUCCESS", title: "Payment received",
        message: `${firstName(actor.name)} recorded ${formatMoney(p.receivedAmount, p.currency)} on ${p.invoiceNumber} (${projectName}).`,
        entityType: "PAYMENT", entityId: p.id,
      });
    } else if (p.status !== "CANCELLED" && prev === null) {
      await this.d.notifications.notify({
        userIds: to, excludeUserId: actor.id, type: "PAYMENT_PENDING", severity: "WARNING", title: "Payment pending",
        message: `${p.invoiceNumber} for ${formatMoney(p.amount, p.currency)} (${projectName}) is awaiting payment.`,
        entityType: "PAYMENT", entityId: p.id,
      });
    }
  }
}
