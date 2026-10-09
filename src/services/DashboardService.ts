import type { Deps } from "./shared";
import { alive } from "./shared";
import type { ProjectService } from "@/modules/projects/project.service";
import type { TaskService, TaskView } from "@/modules/tasks/task.service";
import type { ExpenseService } from "@/modules/expenses/expense.service";
import type { PaymentService } from "@/modules/payments/payment.service";
import { sumFinancials } from "@/modules/projects/finance";
import { can, type Actor } from "@/utils/rbac";
import { today } from "@/utils/query";
import { round2 } from "@/utils/format";

/** Two working weeks of capacity per person; load % = remaining estimated hours of open tasks / capacity. */
export const WORKLOAD_CAPACITY_HOURS = 80;
const isOpen = (t: Pick<TaskView, "status">) => t.status !== "COMPLETED" && t.status !== "CANCELLED";

export class DashboardService {
  constructor(
    private d: Deps,
    private projects: ProjectService,
    private tasks: TaskService,
    private expenses: ExpenseService,
    private payments: PaymentService,
  ) {}

  async teamWorkload(tasks?: TaskView[]) {
    const all = tasks ?? (await this.tasks.list());
    const users = alive(await this.d.repos.users.findAll()).filter((u) => u.active && u.role !== "VIEWER");
    return users.map((u) => {
      const mine = all.filter((t) => isOpen(t) && (t.primaryOwnerId === u.id || t.contributorIds.includes(u.id)));
      // a task's remaining hours are shared between everyone on it
      const hours = mine.reduce((s, t) => s + t.remainingHours / ((t.primaryOwnerId ? 1 : 0) + t.contributorIds.length || 1), 0);
      return {
        userId: u.id, name: u.name, role: u.role, avatar: u.avatar,
        openTasks: mine.length, overdueTasks: mine.filter((t) => t.isOverdue).length,
        remainingHours: round2(hours), utilization: Math.round((hours / WORKLOAD_CAPACITY_HOURS) * 100),
      };
    }).sort((a, b) => b.utilization - a.utilization);
  }

  async get(actor: Actor) {
    const [projects, tasks] = await Promise.all([this.projects.list(actor), this.tasks.list()]);
    const live = projects.filter((p) => p.status !== "CANCELLED");
    const taskCount = (s: string) => tasks.filter((t) => t.status === s).length;
    const showFin = can(actor.role, "finance:view");

    const projectStats = {
      total: projects.length,
      active: projects.filter((p) => p.status === "ACTIVE").length,
      completed: projects.filter((p) => p.status === "COMPLETED").length,
      atRisk: projects.filter((p) => p.health === "AT_RISK" || p.health === "DELAYED").length,
    };
    const taskStats = {
      backlog: taskCount("BACKLOG"), todo: taskCount("TODO"), inProgress: taskCount("IN_PROGRESS"),
      blocked: taskCount("BLOCKED"), review: taskCount("REVIEW"), completed: taskCount("COMPLETED"),
      overdue: tasks.filter((t) => t.isOverdue).length, total: tasks.length,
    };

    const financials = showFin ? sumFinancials(live.map((p) => p.financials!).filter(Boolean)) : null;
    const [expenses, payments, workload] = await Promise.all([
      this.expenses.list(actor),
      showFin ? this.payments.list(actor) : Promise.resolve([]),
      this.teamWorkload(tasks),
    ]);
    const projectName = new Map(projects.map((p) => [p.id, p.name]));
    const in14 = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);

    return {
      projects: projectStats,
      tasks: taskStats,
      financials,
      projectProgress: projects
        .filter((p) => p.status === "ACTIVE" || p.status === "PLANNING")
        .map((p) => ({ id: p.id, name: p.name, progress: p.progress, health: p.health, status: p.status, taskStats: p.taskStats, expectedEndDate: p.expectedEndDate }))
        .sort((a, b) => b.progress - a.progress),
      myTasks: tasks.filter((t) => isOpen(t) && (t.primaryOwnerId === actor.id || t.contributorIds.includes(actor.id))).slice(0, 8),
      recentTasks: [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8),
      recentExpenses: expenses.slice(0, 6).map((e) => ({ ...e, projectName: projectName.get(e.projectId) ?? e.projectId })),
      pendingPayments: payments
        .filter((p) => p.effectiveStatus !== "PAID" && p.effectiveStatus !== "CANCELLED")
        .slice(0, 6).map((p) => ({ ...p, projectName: projectName.get(p.projectId) ?? p.projectId })),
      upcomingDeadlines: [
        ...tasks.filter((t) => isOpen(t) && t.dueDate && t.dueDate >= today() && t.dueDate <= in14)
          .map((t) => ({ type: "task" as const, id: t.id, title: t.title, date: t.dueDate!, projectName: projectName.get(t.projectId) ?? "", priority: t.priority, href: `/tasks?task=${t.id}` })),
        ...projects.filter((p) => (p.status === "ACTIVE" || p.status === "PLANNING") && p.expectedEndDate && p.expectedEndDate >= today() && p.expectedEndDate <= in14)
          .map((p) => ({ type: "project" as const, id: p.id, title: p.name, date: p.expectedEndDate!, projectName: p.name, priority: p.priority, href: `/projects/${p.id}` })),
      ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10),
      teamWorkload: workload,
    };
  }
}
