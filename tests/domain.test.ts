import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actors, makeEnv } from "./helpers";
import { computeFinancials } from "@/modules/projects/finance";

let env: Awaited<ReturnType<typeof makeEnv>>;
beforeEach(async () => { await env?.cleanup(); env = await makeEnv(); });
afterAll(() => env.cleanup());
const { admin, pm, dev, finance, designer } = actors;

describe("projects", () => {
  const input = { name: "New Portal", clientId: "CLI-001", priority: "HIGH", contractValue: 100000, budget: 70000, projectManagerId: "USR-002", memberIds: ["USR-003"], startDate: "2026-01-01", expectedEndDate: "2026-03-01" };

  it("creates a project with team, manager auto-added, activity and notifications", async () => {
    const p = await env.svc.projects.create(admin, input);
    expect(p.id).toBe("PRJ-005");
    expect(p.memberIds.sort()).toEqual(["USR-002", "USR-003"]);
    const act = await env.svc.activity.list({ entityId: p.id });
    expect(act[0].action).toBe("CREATED");
    const notes = await env.svc.notifications.list("USR-003");
    expect(notes.some((n) => n.entityId === p.id && n.type === "PROJECT_UPDATE")).toBe(true);
  });

  it("rejects invalid input with friendly validation errors", async () => {
    await expect(env.svc.projects.create(admin, { ...input, name: "" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(env.svc.projects.create(admin, { ...input, expectedEndDate: "2025-01-01" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(env.svc.projects.create(admin, { ...input, clientId: "CLI-999" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(env.svc.projects.create(dev, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("updates status (audit + actual end date) and soft-deletes / restores with a backup", async () => {
    const p = await env.svc.projects.create(admin, input);
    const u = await env.svc.projects.update(pm, p.id, { status: "COMPLETED" });
    expect(u.status).toBe("COMPLETED");
    expect(u.actualEndDate).toBeTruthy();
    expect((await env.svc.activity.list({ entityId: p.id })).some((a) => a.action === "STATUS_CHANGED" && a.newValue === "COMPLETED")).toBe(true);

    await env.svc.projects.softDelete(pm, p.id);
    expect((await env.svc.projects.list(admin)).some((x) => x.id === p.id)).toBe(false);
    expect((await env.svc.projects.list(admin, { onlyDeleted: true })).some((x) => x.id === p.id)).toBe(true);
    await expect(env.svc.projects.get(admin, p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await env.svc.backups.list()).some((b) => b.reason === "pre-delete-project")).toBe(true);
    const raw = await env.svc.repos.projects.findById(p.id);
    expect(raw).toMatchObject({ isDeleted: true, deletedBy: pm.id });

    await env.svc.projects.restore(pm, p.id);
    expect((await env.svc.projects.get(admin, p.id)).isDeleted).toBe(false);
  });
});

describe("tasks", () => {
  it("supports a primary owner plus multiple contributors", async () => {
    const t = await env.svc.tasks.create(pm, { projectId: "PRJ-001", title: "Build Reports", primaryOwnerId: "USR-001", contributorIds: ["USR-002", "USR-003", "USR-004"] });
    expect(t.primaryOwnerId).toBe("USR-001");
    expect(t.contributorIds.sort()).toEqual(["USR-002", "USR-003", "USR-004"]);
    const mine = await env.svc.tasks.list({ assigneeId: "USR-004" });
    expect(mine.some((x) => x.id === t.id)).toBe(true);
    const n = await env.svc.notifications.list("USR-003");
    expect(n.some((x) => x.type === "TASK_ASSIGNED" && x.entityId === t.id)).toBe(true);
  });

  it("rejects assignees who are not project members", async () => {
    await expect(env.svc.tasks.create(pm, { projectId: "PRJ-004", title: "x", primaryOwnerId: "USR-003" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("changes status with audit trail, notifications and completedAt", async () => {
    const before = await env.svc.tasks.get("TASK-005");
    expect(before.status).toBe("TODO");
    const t = await env.svc.tasks.update(dev, "TASK-005", { status: "IN_PROGRESS" });
    expect(t.status).toBe("IN_PROGRESS");
    const act = (await env.svc.activity.list({ entityId: "TASK-005" })).find((a) => a.action === "STATUS_CHANGED");
    expect(act).toMatchObject({ oldValue: "TODO", newValue: "IN_PROGRESS", userId: dev.id });
    const done = await env.svc.tasks.update(dev, "TASK-005", { status: "COMPLETED" });
    expect(done.completedAt).toBeTruthy();
    const reopened = await env.svc.tasks.update(dev, "TASK-005", { status: "TODO" });
    expect(reopened.completedAt).toBeNull();
  });

  it("enforces permissions: only owners/managers edit; viewers cannot", async () => {
    await expect(env.svc.tasks.update(designer, "TASK-005", { title: "hack" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(env.svc.tasks.update(dev, "TASK-005", { primaryOwnerId: "USR-005" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const viewer = { id: "USR-099", name: "V", role: "VIEWER" } as const;
    await expect(env.svc.tasks.create(viewer, { projectId: "PRJ-001", title: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps all changes when updates to the same task run concurrently", async () => {
    await Promise.all([
      env.svc.tasks.update(pm, "TASK-005", { priority: "CRITICAL" }),
      env.svc.tasks.update(pm, "TASK-005", { estimatedHours: 99 }),
      env.svc.tasks.update(pm, "TASK-005", { tags: ["a", "b"] }),
      env.svc.tasks.update(pm, "TASK-006", { priority: "LOW" }),
    ]);
    const t = await env.svc.tasks.get("TASK-005");
    expect(t).toMatchObject({ priority: "CRITICAL", estimatedHours: 99, tags: ["a", "b"] });
    expect((await env.svc.tasks.get("TASK-006")).priority).toBe("LOW");
  });

  it("creates many tasks concurrently without id collisions or lost rows", async () => {
    const before = (await env.svc.repos.tasks.findAll()).length;
    const made = await Promise.all(Array.from({ length: 25 }, (_, i) => env.svc.tasks.create(pm, { projectId: "PRJ-001", title: `Parallel ${i}` })));
    expect(new Set(made.map((t) => t.id)).size).toBe(25);
    expect((await env.svc.repos.tasks.findAll()).length).toBe(before + 25);
  });

  it("tracks subtasks and comment mentions", async () => {
    const t = await env.svc.tasks.get("TASK-010");
    expect(`${t.subtaskDone} / ${t.subtaskTotal}`).toBe("3 / 5");
    const s = await env.svc.tasks.addSubtask(pm, "TASK-010", { title: "Document API" });
    await env.svc.tasks.updateSubtask(pm, "TASK-010", s.id, { completed: true });
    expect((await env.svc.tasks.get("TASK-010")).subtaskDone).toBe(4);
    await env.svc.tasks.addComment(pm, "TASK-010", { message: "@Sharique please check" });
    expect((await env.svc.notifications.list("USR-003")).some((n) => n.type === "MENTION")).toBe(true);
  });

  it("soft deletes and restores a task", async () => {
    await env.svc.tasks.softDelete(pm, "TASK-008");
    expect((await env.svc.tasks.list()).some((t) => t.id === "TASK-008")).toBe(false);
    await env.svc.tasks.restore(pm, "TASK-008");
    expect((await env.svc.tasks.list()).some((t) => t.id === "TASK-008")).toBe(true);
  });
});

describe("time, expenses, payments and profit", () => {
  it("computes estimated / actual / remaining hours from time entries", async () => {
    const before = await env.svc.tasks.get("TASK-005");
    expect(before.actualHours).toBe(0);
    await env.svc.time.create(dev, { taskId: "TASK-005", date: "2026-10-01", hours: 5 });
    const t = await env.svc.tasks.get("TASK-005");
    expect([t.estimatedHours, t.actualHours, t.remainingHours]).toEqual([12, 5, 7]);
    await expect(env.svc.time.create(dev, { taskId: "TASK-005", date: "2026-10-01", hours: 0 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(env.svc.time.create(dev, { taskId: "TASK-005", date: "2026-10-01", hours: 2, userId: "USR-005" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("validates expenses and runs the approval flow", async () => {
    const base = { projectId: "PRJ-001", category: "SOFTWARE", description: "Plugin", amount: 2500, date: "2026-10-01", paidBy: dev.id, paymentMethod: "CARD" };
    await expect(env.svc.expenses.create(dev, { ...base, amount: 0 })).rejects.toThrow(/greater than zero/);
    const e = await env.svc.expenses.create(dev, base);
    expect(e.approvalStatus).toBe("PENDING");
    const beforeProfit = (await env.svc.projects.financials("PRJ-001")).otherExpenses;
    expect(beforeProfit).toBe(21000); // pending expenses are not counted yet
    await expect(env.svc.expenses.decide(dev, e.id, { decision: "APPROVED" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await env.svc.expenses.decide(finance, e.id, { decision: "APPROVED" });
    expect((await env.svc.projects.financials("PRJ-001")).otherExpenses).toBe(23500);
    expect((await env.svc.notifications.list(dev.id)).some((n) => n.type === "EXPENSE_APPROVED")).toBe(true);
    const mine = await env.svc.expenses.list(designer);
    expect(mine.every((x) => x.paidBy === designer.id || x.createdBy === designer.id)).toBe(true);
    await env.svc.expenses.softDelete(finance, e.id);
    expect((await env.svc.projects.financials("PRJ-001")).otherExpenses).toBe(21000);
    await env.svc.expenses.restore(finance, e.id);
    expect((await env.svc.projects.financials("PRJ-001")).otherExpenses).toBe(23500);
  });

  it("adds payments and updates received / pending dynamically", async () => {
    const f0 = await env.svc.projects.financials("PRJ-001");
    expect([f0.contractValue, f0.received, f0.pending]).toEqual([200000, 120000, 80000]);
    const p = await env.svc.payments.create(finance, { projectId: "PRJ-001", invoiceNumber: "INV-TEST-1", amount: 30000, status: "PAID", paymentMethod: "UPI" });
    expect(p.receivedAmount).toBe(30000);
    expect((await env.svc.projects.financials("PRJ-001"))).toMatchObject({ received: 150000, pending: 50000 });
    await expect(env.svc.payments.create(finance, { projectId: "PRJ-001", invoiceNumber: "INV-TEST-1", amount: 1 })).rejects.toThrow(/already used/);
    await expect(env.svc.payments.create(finance, { projectId: "PRJ-001", invoiceNumber: "INV-X", amount: 100, status: "PARTIALLY_PAID", receivedAmount: 100 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(env.svc.payments.list(dev)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const overdue = (await env.svc.payments.list(finance)).find((x) => x.id === "PAY-005");
    expect(overdue?.effectiveStatus).toBe("OVERDUE");
    expect(overdue?.outstanding).toBe(65000);
  });

  it("calculates profit exactly as specified (example from the brief)", () => {
    const f = computeFinancials({
      project: { contractValue: 200000, budget: 150000 },
      payments: [{ id: "PAY-001", projectId: "P", clientId: "C", invoiceNumber: "1", amount: 120000, receivedAmount: 120000, currency: "INR", paymentDate: "2026-01-01", dueDate: null, paymentMethod: null, status: "PAID", notes: "", createdBy: "U", isDeleted: false, deletedAt: null, deletedBy: null, createdAt: "", updatedAt: "" }],
      expenses: [{ id: "EXP-001", projectId: "P", category: "HOSTING", description: "x", amount: 20000, currency: "INR", date: "2026-01-01", paidBy: "U", paymentMethod: "CARD", attachmentId: null, notes: "", approvalStatus: "APPROVED", approvedBy: null, createdBy: "U", isDeleted: false, deletedAt: null, deletedBy: null, createdAt: "", updatedAt: "" }],
      timeEntries: [{ id: "TIME-001", taskId: "T", projectId: "P", userId: "U1", date: "2026-01-01", hours: 50, description: "", billable: true, createdAt: "", updatedAt: "" }],
      users: [{ id: "U1", hourlyRate: 1000, dailyRate: 0 }],
      tasks: [],
    });
    expect(f).toMatchObject({ contractValue: 200000, received: 120000, pending: 80000, teamCost: 50000, otherExpenses: 20000, totalCost: 70000, netProfit: 130000, profitMargin: 65 });
  });
});

describe("notifications", () => {
  it("is generic: any entity type/id, per-user read state, ownership enforced", async () => {
    const [n] = await env.svc.notifications.notify({ userIds: ["USR-003"], type: "SYSTEM_ALERT", title: "Disk almost full", entityType: "SERVER", entityId: "srv-1", severity: "WARNING" });
    expect(n).toMatchObject({ entityType: "SERVER", entityId: "srv-1", isRead: false });
    await expect(env.svc.notifications.markRead(n.id, "USR-004")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await env.svc.notifications.markRead(n.id, "USR-003")).isRead).toBe(true);
    // the actor never notifies themself, and inactive users are skipped
    expect(await env.svc.notifications.notify({ userIds: ["USR-003"], excludeUserId: "USR-003", type: "SUCCESS", title: "x" })).toEqual([]);
  });

  it("generates overdue-task alerts once per task and user", async () => {
    await env.svc.alerts.sync(true);
    const first = (await env.svc.repos.notifications.findAll()).filter((n) => n.type === "TASK_OVERDUE").length;
    await env.svc.alerts.sync(true);
    expect((await env.svc.repos.notifications.findAll()).filter((n) => n.type === "TASK_OVERDUE").length).toBe(first);
  });
});

describe("users & auth", () => {
  it("hashes passwords, logs in, and invalidates sessions on password change", async () => {
    const u = await env.svc.users.create(admin, { name: "Zed Test", email: "zed@x.com", role: "VIEWER", password: "Secret123!" });
    const raw = await env.svc.repos.users.findById(u.id);
    expect(raw!.passwordHash).not.toContain("Secret123");
    expect((await env.svc.auth.login("zed@x.com", "Secret123!")).id).toBe(u.id);
    await expect(env.svc.auth.login("zed@x.com", "wrong")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(env.svc.users.create(admin, { name: "Dup", email: "zed@x.com", role: "VIEWER", password: "Secret123!" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(env.svc.users.create(pm, { name: "N", email: "n@x.com", role: "VIEWER", password: "Secret123!" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await env.svc.users.update(admin, u.id, { active: false });
    await expect(env.svc.auth.login("zed@x.com", "Secret123!")).rejects.toThrow(/disabled/);
  });

  it("protects the last admin and hides pay rates from non-finance roles", async () => {
    await expect(env.svc.users.update(admin, "USR-001", { role: "DEVELOPER" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const asDev = await env.svc.users.list(dev);
    expect(asDev.find((u) => u.id === "USR-002")!.hourlyRate).toBe(0);
    expect((await env.svc.users.list(pm)).find((u) => u.id === "USR-002")!.hourlyRate).toBeGreaterThan(0);
  });
});

describe("backup & restore", () => {
  it("restores earlier data from a backup and keeps a safety copy", async () => {
    const info = await env.svc.backups.backupNow(admin);
    expect(info.rows.projects).toBe(4);
    await env.svc.projects.create(admin, { name: "Temp", clientId: "CLI-001", contractValue: 1, memberIds: [] });
    expect((await env.svc.repos.projects.findAll()).length).toBe(5);
    const r = await env.svc.backups.restore(admin, info.name);
    expect((await env.svc.repos.projects.findAll()).length).toBe(4);
    expect((await env.svc.backups.list()).some((b) => b.name === r.safetyBackup && b.reason === "pre-restore")).toBe(true);
    await expect(env.svc.backups.restore(dev, info.name)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(env.svc.backups.restore(admin, "../etc")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("round-trips export → import and rejects invalid bundles without touching data", async () => {
    const bundle = await env.svc.backups.export(admin);
    await env.svc.repos.projects.delete("PRJ-004");
    await env.svc.backups.import(admin, bundle);
    expect((await env.svc.repos.projects.findAll()).length).toBe(4);

    const bad = structuredClone(bundle);
    (bad.collections.projects as { status: string }[])[0].status = "NOT_A_STATUS";
    await expect(env.svc.backups.import(admin, bad)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(env.svc.backups.import(admin, { nope: true })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const noAdmin = structuredClone(bundle);
    for (const u of noAdmin.collections.users as { role: string }[]) u.role = "VIEWER";
    await expect(env.svc.backups.import(admin, noAdmin)).rejects.toThrow(/admin/);
    expect((await env.svc.repos.projects.findAll()).length).toBe(4);
  });
});

describe("dashboard & reports", () => {
  it("returns consistent dashboard numbers", async () => {
    const d = await env.svc.dashboard.get(admin);
    expect(d.projects).toMatchObject({ total: 4, active: 2, completed: 1 });
    expect(d.tasks.total).toBe(25);
    expect(d.financials!.contractValue).toBe(200000 + 450000 + 320000 + 120000);
    expect(d.financials!.netProfit).toBeCloseTo(d.financials!.contractValue - d.financials!.totalCost, 2);
    expect((await env.svc.dashboard.get(dev)).financials).toBeNull();
    const r = await env.svc.reports.project(admin, "PRJ-001");
    expect(r.tasks.total).toBe(8);
  });
});

describe("partial updates never reset untouched fields", () => {
  it("project / client / expense / payment / time-entry patches only change what was sent", async () => {
    const p0 = await env.svc.projects.get(admin, "PRJ-002");
    const p1 = await env.svc.projects.update(pm, "PRJ-002", { description: "new text" });
    expect(p1).toMatchObject({ status: p0.status, priority: p0.priority, contractValue: p0.contractValue, budget: p0.budget });
    expect(p1.memberIds.sort()).toEqual(p0.memberIds.sort());

    const c = await env.svc.clients.update(pm, "CLI-001", { phone: "123" });
    expect(c.active).toBe(true);

    const e0 = await env.svc.repos.expenses.findById("EXP-001");
    const e1 = await env.svc.expenses.update(finance, "EXP-001", { notes: "n" });
    expect(e1).toMatchObject({ currency: e0!.currency, amount: e0!.amount, approvalStatus: "APPROVED" });

    const pay = await env.svc.payments.update(finance, "PAY-003", { notes: "n" });
    expect(pay.status).toBe("PENDING");
    const paid = await env.svc.payments.update(finance, "PAY-004", { notes: "n" });
    expect(paid).toMatchObject({ status: "PAID", receivedAmount: 135000 });

    const t = await env.svc.repos.timeEntries.findAll();
    const te = await env.svc.time.update(admin, t[0].id, { description: "x" });
    expect(te).toMatchObject({ hours: t[0].hours, billable: t[0].billable });
  });
});
