import type { Expense, Payment, Project, Task, TimeEntry, User } from "@/schemas/entities";
import { round2 } from "@/utils/format";
import { today } from "@/utils/query";
import { effectiveHourlyRate } from "@/modules/users/user.service";

export interface ProjectFinancials {
  contractValue: number;
  budget: number;
  received: number;
  pending: number;
  teamCost: number;
  otherExpenses: number;
  totalCost: number;
  netProfit: number;
  profitMargin: number; // % of contract value
  cashProfit: number; // received - total cost
  budgetUsedPct: number;
  expenseBreakdown: { total: number; team: number; software: number; other: number; pendingApproval: number };
  hours: { estimated: number; actual: number; remaining: number; billable: number };
  invoiced: number;
}

/** Effective payment status: unpaid invoices past their due date are OVERDUE. */
export function effectivePaymentStatus(p: Pick<Payment, "status" | "dueDate">): Payment["status"] {
  if ((p.status === "PENDING" || p.status === "PARTIALLY_PAID") && p.dueDate && p.dueDate < today()) return "OVERDUE";
  return p.status;
}

export const receivedOf = (p: Payment) =>
  p.status === "CANCELLED" ? 0 : p.status === "PAID" ? p.amount : Math.min(p.receivedAmount, p.amount);

/**
 * Pure calculation: nothing here is persisted, everything derives from payments + time entries + expenses.
 *   Net Profit = Contract Value - (Team Cost + Expenses); Margin = Net Profit / Contract Value.
 * Only APPROVED, non-deleted expenses count; team cost = Σ(hours × user rate).
 */
export function computeFinancials(input: {
  project: Pick<Project, "contractValue" | "budget">;
  payments: Payment[];
  expenses: Expense[];
  timeEntries: TimeEntry[];
  users: Pick<User, "id" | "hourlyRate" | "dailyRate">[];
  tasks: Pick<Task, "estimatedHours" | "isDeleted" | "status">[];
}): ProjectFinancials {
  const { project } = input;
  const rate = new Map(input.users.map((u) => [u.id, effectiveHourlyRate(u)]));
  const payments = input.payments.filter((p) => !p.isDeleted);
  const received = payments.reduce((s, p) => s + receivedOf(p), 0);
  const invoiced = payments.filter((p) => p.status !== "CANCELLED").reduce((s, p) => s + p.amount, 0);

  const exps = input.expenses.filter((e) => !e.isDeleted);
  const approved = exps.filter((e) => e.approvalStatus === "APPROVED");
  const sum = (xs: Expense[]) => xs.reduce((s, e) => s + e.amount, 0);
  const total = sum(approved);
  const team = sum(approved.filter((e) => e.category === "TEAM"));
  const software = sum(approved.filter((e) => e.category === "SOFTWARE"));

  const teamCost = input.timeEntries.reduce((s, t) => s + t.hours * (rate.get(t.userId) ?? 0), 0);
  const actual = input.timeEntries.reduce((s, t) => s + t.hours, 0);
  const billable = input.timeEntries.filter((t) => t.billable).reduce((s, t) => s + t.hours, 0);
  const estimated = input.tasks
    .filter((t) => !t.isDeleted && t.status !== "CANCELLED")
    .reduce((s, t) => s + t.estimatedHours, 0);

  const totalCost = teamCost + total;
  const netProfit = project.contractValue - totalCost;
  return {
    contractValue: project.contractValue,
    budget: project.budget,
    received: round2(received),
    pending: round2(Math.max(project.contractValue - received, 0)),
    teamCost: round2(teamCost),
    otherExpenses: round2(total),
    totalCost: round2(totalCost),
    netProfit: round2(netProfit),
    profitMargin: project.contractValue > 0 ? round2((netProfit / project.contractValue) * 100) : 0,
    cashProfit: round2(received - totalCost),
    budgetUsedPct: project.budget > 0 ? round2((totalCost / project.budget) * 100) : 0,
    expenseBreakdown: {
      total: round2(total),
      team: round2(team),
      software: round2(software),
      other: round2(total - team - software),
      pendingApproval: round2(sum(exps.filter((e) => e.approvalStatus === "PENDING"))),
    },
    hours: {
      estimated: round2(estimated),
      actual: round2(actual),
      remaining: round2(Math.max(estimated - actual, 0)),
      billable: round2(billable),
    },
    invoiced: round2(invoiced),
  };
}

export const sumFinancials = (list: ProjectFinancials[]) => {
  const s = (f: (x: ProjectFinancials) => number) => round2(list.reduce((a, x) => a + f(x), 0));
  const contractValue = s((x) => x.contractValue);
  const totalCost = s((x) => x.totalCost);
  const netProfit = round2(contractValue - totalCost);
  return {
    contractValue,
    received: s((x) => x.received),
    pending: s((x) => x.pending),
    teamCost: s((x) => x.teamCost),
    otherExpenses: s((x) => x.otherExpenses),
    totalCost,
    netProfit,
    profitMargin: contractValue > 0 ? round2((netProfit / contractValue) * 100) : 0,
    cashProfit: s((x) => x.cashProfit),
  };
};
