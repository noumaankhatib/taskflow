import type { Deps } from "./shared";
import { usersWithPerm } from "./shared";
import { effectivePaymentStatus } from "@/modules/projects/finance";
import { formatMoney } from "@/utils/format";
import { today } from "@/utils/query";

const g = globalThis as unknown as { __lastAlertSync?: number };
const INTERVAL_MS = 5 * 60_000;

/**
 * Time-based notifications (overdue tasks / payments). There is no scheduler in V1, so they are
 * generated lazily (throttled) whenever a user opens the app. Each entity alerts at most once.
 */
export class AlertService {
  constructor(private d: Deps) {}

  async sync(force = false) {
    if (!force && g.__lastAlertSync && Date.now() - g.__lastAlertSync < INTERVAL_MS) return;
    g.__lastAlertSync = Date.now();
    const r = this.d.repos;
    const [tasks, assignees, payments, existing, projects] = await Promise.all([
      r.tasks.findAll(), r.taskAssignees.findAll(), r.payments.findAll(), r.notifications.findAll(), r.projects.findAll(),
    ]);
    const seen = new Set(existing.filter((n) => n.type === "TASK_OVERDUE" || n.title === "Payment overdue").map((n) => `${n.type}:${n.entityId}:${n.userId}`));
    const liveProjects = new Map(projects.filter((p) => !p.isDeleted).map((p) => [p.id, p]));

    for (const t of tasks) {
      if (t.isDeleted || t.status === "COMPLETED" || t.status === "CANCELLED" || !t.dueDate || t.dueDate >= today()) continue;
      const proj = liveProjects.get(t.projectId);
      if (!proj) continue;
      const who = [...assignees.filter((a) => a.taskId === t.id).map((a) => a.userId), proj.projectManagerId].filter(Boolean) as string[];
      const fresh = who.filter((u) => !seen.has(`TASK_OVERDUE:${t.id}:${u}`));
      if (fresh.length) {
        await this.d.notifications.notify({
          userIds: fresh, type: "TASK_OVERDUE", severity: "ERROR", title: "Task overdue",
          message: `"${t.title}" was due on ${t.dueDate}.`, entityType: "TASK", entityId: t.id,
        });
      }
    }

    const finance = (await usersWithPerm(r, "finance:view")).map((u) => u.id);
    for (const p of payments) {
      if (p.isDeleted || !liveProjects.has(p.projectId) || effectivePaymentStatus(p) !== "OVERDUE") continue;
      const fresh = finance.filter((u) => !seen.has(`PAYMENT_PENDING:${p.id}:${u}`));
      if (fresh.length) {
        await this.d.notifications.notify({
          userIds: fresh, type: "PAYMENT_PENDING", severity: "WARNING", title: "Payment overdue",
          message: `${p.invoiceNumber} (${formatMoney(p.amount - p.receivedAmount, p.currency)}) was due ${p.dueDate}.`,
          entityType: "PAYMENT", entityId: p.id,
        });
      }
    }
  }
}
