import type { Deps } from "./shared";
import { alive } from "./shared";
import type { ProjectService } from "@/modules/projects/project.service";
import { effectiveHourlyRate } from "@/modules/users/user.service";
import { notFound } from "@/utils/errors";
import { requirePerm, type Actor } from "@/utils/rbac";
import { round2 } from "@/utils/format";
import { today } from "@/utils/query";
import { EXPENSE_CATEGORIES } from "@/schemas/entities";

const inRange = (d: string, from?: string, to?: string) => (!from || d >= from) && (!to || d <= to);

export class ReportService {
  constructor(private d: Deps, private projects: ProjectService) {}

  async project(actor: Actor, id: string) {
    requirePerm(actor, "report:view");
    const r = this.d.repos;
    const project = await r.projects.findById(id);
    if (!project) throw notFound("Project");
    const [tasks, time, expenses, users, view] = await Promise.all([
      r.tasks.find({ projectId: id }), r.timeEntries.find({ projectId: id }), r.expenses.find({ projectId: id }), r.users.findAll(),
      this.projects.get(actor, id, true),
    ]);
    const liveTasks = alive(tasks).filter((t) => t.status !== "CANCELLED");
    const approved = alive(expenses).filter((e) => e.approvalStatus === "APPROVED");
    const byCategory = EXPENSE_CATEGORIES.map((c) => ({ category: c, amount: round2(approved.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0)) })).filter((x) => x.amount > 0);
    const byMember = users.map((u) => {
      const entries = time.filter((t) => t.userId === u.id);
      const hours = entries.reduce((s, t) => s + t.hours, 0);
      return { userId: u.id, name: u.name, hours: round2(hours), cost: round2(hours * effectiveHourlyRate(u)) };
    }).filter((x) => x.hours > 0).sort((a, b) => b.hours - a.hours);
    const completed = liveTasks.filter((t) => t.status === "COMPLETED").length;
    return {
      project: { id: project.id, name: project.name, status: project.status, clientId: project.clientId },
      financials: view.financials,
      tasks: {
        total: liveTasks.length, completed, completionPct: liveTasks.length ? Math.round((completed / liveTasks.length) * 100) : 0,
        overdue: liveTasks.filter((t) => t.status !== "COMPLETED" && t.dueDate && t.dueDate < today()).length,
        byStatus: Object.fromEntries(["BACKLOG", "TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED"].map((s) => [s, liveTasks.filter((t) => t.status === s).length])),
      },
      hoursByMember: byMember,
      expensesByCategory: byCategory,
    };
  }

  async team(actor: Actor, f: { from?: string; to?: string } = {}) {
    requirePerm(actor, "report:view");
    const r = this.d.repos;
    const [users, tasks, assignees, time, projects] = await Promise.all([
      r.users.findAll(), r.tasks.findAll(), r.taskAssignees.findAll(), r.timeEntries.findAll(), r.projects.findAll(),
    ]);
    const pName = new Map(projects.map((p) => [p.id, p.name]));
    const liveTasks = alive(tasks).filter((t) => !projects.find((p) => p.id === t.projectId)?.isDeleted);
    return alive(users).filter((u) => u.role !== "VIEWER").map((u) => {
      const mine = liveTasks.filter((t) => assignees.some((a) => a.taskId === t.id && a.userId === u.id));
      const entries = time.filter((t) => t.userId === u.id && inRange(t.date, f.from, f.to));
      const alloc = new Map<string, number>();
      for (const e of entries) alloc.set(e.projectId, (alloc.get(e.projectId) ?? 0) + e.hours);
      const open = mine.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED");
      const hours = entries.reduce((s, e) => s + e.hours, 0);
      return {
        userId: u.id, name: u.name, role: u.role,
        tasksCompleted: mine.filter((t) => t.status === "COMPLETED" && t.completedAt && inRange(t.completedAt.slice(0, 10), f.from, f.to)).length,
        hoursWorked: round2(hours),
        billableHours: round2(entries.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0)),
        activeTasks: open.length,
        overdueTasks: open.filter((t) => t.dueDate && t.dueDate < today()).length,
        cost: round2(hours * effectiveHourlyRate(u)),
        projectAllocation: [...alloc].map(([projectId, h]) => ({ projectId, name: pName.get(projectId) ?? projectId, hours: round2(h), pct: hours ? Math.round((h / hours) * 100) : 0 })).sort((a, b) => b.hours - a.hours),
      };
    }).sort((a, b) => b.hoursWorked - a.hoursWorked);
  }

  async expenses(actor: Actor, f: { from?: string; to?: string; projectId?: string } = {}) {
    requirePerm(actor, "report:view");
    const r = this.d.repos;
    const [expenses, projects, users] = await Promise.all([r.expenses.findAll(), r.projects.findAll(), r.users.findAll()]);
    const rows = alive(expenses).filter(
      (e) => e.approvalStatus === "APPROVED" && inRange(e.date, f.from, f.to) && (!f.projectId || e.projectId === f.projectId) && !projects.find((p) => p.id === e.projectId)?.isDeleted,
    );
    const total = round2(rows.reduce((s, e) => s + e.amount, 0));
    const group = <K extends string>(key: (e: (typeof rows)[number]) => K) => {
      const m = new Map<K, number>();
      for (const e of rows) m.set(key(e), (m.get(key(e)) ?? 0) + e.amount);
      return [...m].map(([k, amount]) => ({ key: k, amount: round2(amount), pct: total ? Math.round((amount / total) * 100) : 0 })).sort((a, b) => b.amount - a.amount);
    };
    const name = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? id;
    return {
      total, count: rows.length,
      byProject: group((e) => e.projectId).map((x) => ({ ...x, name: name(projects, x.key) })),
      byCategory: group((e) => e.category),
      byMember: group((e) => e.paidBy).map((x) => ({ ...x, name: name(users, x.key) })),
      monthly: group((e) => e.date.slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key)),
    };
  }
}
