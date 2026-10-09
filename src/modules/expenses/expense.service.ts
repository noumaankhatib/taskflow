import type { Deps } from "@/services/shared";
import { firstName, getProjectOrThrow, usersWithPerm } from "@/services/shared";
import type { Expense } from "@/schemas/entities";
import { ExpenseCreateInput, ExpenseDecisionInput, ExpenseUpdateInput } from "@/schemas/inputs";
import { parse } from "@/utils/validate";
import { can, requirePerm, type Actor } from "@/utils/rbac";
import { forbidden, invalid, notFound } from "@/utils/errors";
import { csv, matchesText } from "@/utils/query";
import { formatMoney, round2 } from "@/utils/format";

export interface ExpenseFilter {
  projectId?: string;
  category?: string[];
  paidBy?: string;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  approvalStatus?: string;
  q?: string;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
}

export const expenseFilterFromParams = (sp: URLSearchParams): ExpenseFilter => {
  const num = (k: string) => (sp.get(k) && !Number.isNaN(Number(sp.get(k))) ? Number(sp.get(k)) : undefined);
  return {
    projectId: sp.get("projectId") ?? undefined,
    category: csv(sp.get("category")),
    paidBy: sp.get("paidBy") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    minAmount: num("minAmount"),
    maxAmount: num("maxAmount"),
    approvalStatus: sp.get("approvalStatus") ?? undefined,
    q: sp.get("q") ?? undefined,
    onlyDeleted: sp.get("deleted") === "true" ? true : undefined,
  };
};

export class ExpenseService {
  constructor(private d: Deps) {}

  /** Finance-capable roles see everything; others only expenses they submitted or paid. */
  private visible(actor: Actor, e: Expense) {
    return can(actor.role, "finance:view") || e.createdBy === actor.id || e.paidBy === actor.id;
  }

  async list(actor: Actor, f: ExpenseFilter = {}) {
    const projects = new Map((await this.d.repos.projects.findAll()).map((p) => [p.id, p]));
    return (await this.d.repos.expenses.findAll())
      .filter((e) => {
        if (f.onlyDeleted ? !e.isDeleted : !f.includeDeleted && e.isDeleted) return false;
        if (!f.onlyDeleted && projects.get(e.projectId)?.isDeleted) return false;
        return (
          this.visible(actor, e) &&
          (!f.projectId || e.projectId === f.projectId) &&
          (!f.category?.length || f.category.includes(e.category)) &&
          (!f.paidBy || e.paidBy === f.paidBy) &&
          (!f.from || e.date >= f.from) && (!f.to || e.date <= f.to) &&
          (f.minAmount === undefined || e.amount >= f.minAmount) &&
          (f.maxAmount === undefined || e.amount <= f.maxAmount) &&
          (!f.approvalStatus || e.approvalStatus === f.approvalStatus) &&
          matchesText(f.q, e.description, e.notes, e.id)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  summarize(rows: Expense[]) {
    const approved = rows.filter((e) => !e.isDeleted && e.approvalStatus === "APPROVED");
    const sum = (xs: Expense[]) => round2(xs.reduce((s, e) => s + e.amount, 0));
    const total = sum(approved);
    const team = sum(approved.filter((e) => e.category === "TEAM"));
    const software = sum(approved.filter((e) => e.category === "SOFTWARE"));
    return {
      total, team, software, other: round2(total - team - software),
      pending: sum(rows.filter((e) => !e.isDeleted && e.approvalStatus === "PENDING")),
      count: rows.length,
    };
  }

  async get(actor: Actor, id: string) {
    const e = await this.d.repos.expenses.findById(id);
    if (!e || !this.visible(actor, e)) throw notFound("Expense");
    return e;
  }

  async create(actor: Actor, raw: unknown) {
    requirePerm(actor, "expense:write");
    const input = parse(ExpenseCreateInput, raw);
    const project = await getProjectOrThrow(this.d.repos, input.projectId);
    await this.assertPayer(input.paidBy);
    if (!can(actor.role, "finance:view") && input.paidBy !== actor.id) throw forbidden("You can only submit expenses paid by you.");
    await this.assertAttachment(input.attachmentId ?? null, input.projectId);
    const approver = can(actor.role, "expense:approve");
    const e = await this.d.repos.expenses.create({
      ...input,
      attachmentId: input.attachmentId ?? null,
      approvalStatus: approver ? "APPROVED" : "PENDING",
      approvedBy: approver ? actor.id : null,
      createdBy: actor.id,
      isDeleted: false, deletedAt: null, deletedBy: null,
    });
    await this.linkReceipt(e);
    await this.d.activity.log({
      entityType: "EXPENSE", entityId: e.id, projectId: e.projectId, action: "EXPENSE_ADDED", userId: actor.id,
      newValue: { amount: e.amount, category: e.category },
      message: `${actor.name} added expense ${formatMoney(e.amount, e.currency)} (${e.description})`,
    });
    if (approver) {
      await this.d.notifications.notify({
        userIds: [project.projectManagerId], excludeUserId: actor.id, type: "EXPENSE_ADDED",
        title: "Expense added", message: `${firstName(actor.name)} added ${formatMoney(e.amount, e.currency)} to ${project.name}.`,
        entityType: "EXPENSE", entityId: e.id,
      });
    } else {
      const approvers = await usersWithPerm(this.d.repos, "expense:approve");
      await this.d.notifications.notify({
        userIds: [project.projectManagerId, ...approvers.map((u) => u.id)], excludeUserId: actor.id,
        type: "APPROVAL_REQUIRED", severity: "WARNING", title: "Expense needs approval",
        message: `${firstName(actor.name)} submitted ${formatMoney(e.amount, e.currency)} for ${project.name}.`,
        entityType: "EXPENSE", entityId: e.id,
      });
    }
    return e;
  }

  async update(actor: Actor, id: string, raw: unknown) {
    const before = await this.d.repos.expenses.findById(id);
    if (!before || before.isDeleted) throw notFound("Expense");
    this.assertCanModify(actor, before);
    const patch = parse(ExpenseUpdateInput, raw);
    if (patch.projectId) await getProjectOrThrow(this.d.repos, patch.projectId);
    if (patch.paidBy) await this.assertPayer(patch.paidBy);
    await this.assertAttachment(patch.attachmentId ?? null, patch.projectId ?? before.projectId);
    const clean: Partial<Expense> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) (clean as Record<string, unknown>)[k] = v;
    // edits by non-approvers send the expense back for approval
    if (!can(actor.role, "expense:approve") && before.approvalStatus !== "PENDING") {
      Object.assign(clean, { approvalStatus: "PENDING", approvedBy: null });
    }
    const after = await this.d.repos.expenses.update(id, clean);
    await this.linkReceipt(after);
    await this.d.activity.log({
      entityType: "EXPENSE", entityId: id, projectId: after.projectId, action: "UPDATED", userId: actor.id,
      oldValue: { amount: before.amount }, newValue: { amount: after.amount },
      message: `${actor.name} updated expense ${after.id} (${formatMoney(after.amount, after.currency)})`,
    });
    return after;
  }

  async decide(actor: Actor, id: string, raw: unknown) {
    requirePerm(actor, "expense:approve");
    const { decision } = parse(ExpenseDecisionInput, raw);
    const e = await this.d.repos.expenses.findById(id);
    if (!e || e.isDeleted) throw notFound("Expense");
    if (e.createdBy === actor.id && actor.role !== "ADMIN") throw forbidden("You cannot approve your own expense.");
    if (e.approvalStatus === decision) throw invalid(`Expense is already ${decision.toLowerCase()}.`);
    const after = await this.d.repos.expenses.update(id, { approvalStatus: decision, approvedBy: actor.id });
    await this.d.activity.log({
      entityType: "EXPENSE", entityId: id, projectId: e.projectId, action: decision === "APPROVED" ? "APPROVED" : "REJECTED",
      userId: actor.id, oldValue: e.approvalStatus, newValue: decision,
      message: `${actor.name} ${decision === "APPROVED" ? "approved" : "rejected"} expense ${formatMoney(e.amount, e.currency)}`,
    });
    await this.d.notifications.notify({
      userIds: [e.createdBy, e.paidBy], excludeUserId: actor.id, type: "EXPENSE_APPROVED",
      severity: decision === "APPROVED" ? "SUCCESS" : "ERROR",
      title: decision === "APPROVED" ? "Expense approved" : "Expense rejected",
      message: `${e.description} (${formatMoney(e.amount, e.currency)})`, entityType: "EXPENSE", entityId: id,
    });
    return after;
  }

  async softDelete(actor: Actor, id: string) {
    const e = await this.d.repos.expenses.findById(id);
    if (!e || e.isDeleted) throw notFound("Expense");
    this.assertCanModify(actor, e);
    await this.d.repos.expenses.update(id, { isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: actor.id });
    await this.d.activity.log({
      entityType: "EXPENSE", entityId: id, projectId: e.projectId, action: "DELETED", userId: actor.id,
      message: `${actor.name} deleted expense ${formatMoney(e.amount, e.currency)} (${e.description})`,
    });
  }

  async restore(actor: Actor, id: string) {
    requirePerm(actor, "expense:approve");
    const e = await this.d.repos.expenses.findById(id);
    if (!e || !e.isDeleted) throw notFound("Expense");
    const after = await this.d.repos.expenses.update(id, { isDeleted: false, deletedAt: null, deletedBy: null });
    await this.d.activity.log({
      entityType: "EXPENSE", entityId: id, projectId: e.projectId, action: "RESTORED", userId: actor.id,
      message: `${actor.name} restored expense ${e.description}`,
    });
    return after;
  }

  private assertCanModify(actor: Actor, e: Expense) {
    requirePerm(actor, "expense:write");
    if (can(actor.role, "expense:approve")) return;
    // submitters may change their own expenses until they are approved
    if (e.createdBy !== actor.id || e.approvalStatus === "APPROVED") {
      throw forbidden("Approved expenses can only be changed by a project manager or finance.");
    }
  }

  /** Receipts are uploaded before the expense exists; bind them once it does. */
  private async linkReceipt(e: Expense) {
    if (!e.attachmentId) return;
    const a = await this.d.repos.attachments.findById(e.attachmentId);
    if (a && a.entityId !== e.id) await this.d.repos.attachments.update(a.id, { entityType: "EXPENSE", entityId: e.id });
  }

  private async assertPayer(userId: string) {
    const u = await this.d.repos.users.findById(userId);
    if (!u || u.isDeleted) throw invalid("Selected 'paid by' user does not exist.");
  }

  private async assertAttachment(id: string | null, projectId: string) {
    if (!id) return;
    const a = await this.d.repos.attachments.findById(id);
    if (!a || a.isDeleted || a.projectId !== projectId) throw invalid("Attachment not found for this project.");
  }
}
