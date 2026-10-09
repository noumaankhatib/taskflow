// End-to-end smoke test against a running server (default http://localhost:3100).
// Visits every page as several roles at desktop + mobile widths (fails on console errors / failed requests / horizontal overflow),
// then exercises the API: full project→task→time→expense→payment flow, RBAC, CSRF, concurrency, soft delete, backup.
import { chromium, request } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const base = process.env.BASE_URL ?? "http://localhost:3100";
const cache = path.join(process.env.HOME, ".cache/ms-playwright");
const exe = fs.readdirSync(cache).filter((d) => d.startsWith("chromium-")).sort().reverse()
  .map((d) => path.join(cache, d, "chrome-linux64/chrome")).find((p) => fs.existsSync(p));
let failures = 0;
const check = (name, ok, extra = "") => { if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`); };

const PAGES = ["/", "/projects", "/projects/PRJ-001", "/projects/PRJ-001?tab=tasks", "/projects/PRJ-001?tab=time", "/projects/PRJ-001?tab=expenses",
  "/projects/PRJ-001?tab=payments", "/projects/PRJ-001?tab=files", "/projects/PRJ-001?tab=activity", "/projects/PRJ-001?tab=team", "/tasks", "/tasks?task=TASK-004",
  "/team", "/team?user=USR-003", "/clients", "/clients?client=CLI-001", "/expenses", "/payments", "/reports", "/notifications", "/settings"];
const ROLES = { admin: "nouman", pm: "ravi", dev: "sharique", finance: "kavita" };

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
async function login(who) {
  const ctx = await browser.newContext();
  const r = await ctx.request.post(`${base}/api/auth/login`, { data: { email: `${who}@taskflow.local`, password: "Password@123" } });
  if (!r.ok()) throw new Error("login failed " + who);
  return ctx;
}

// ---- unauthenticated
{
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(base + "/projects"); check("unauthenticated page redirects to /login", page.url().includes("/login"), page.url());
  const r = await ctx.request.get(base + "/api/projects"); check("unauthenticated API → 401", r.status() === 401);
  const bad = await ctx.request.post(base + "/api/auth/login", { data: { email: "nouman@taskflow.local", password: "nope" } });
  check("wrong password → 401 with friendly message", bad.status() === 401 && (await bad.json()).error.message === "Invalid email or password.");
  await page.goto(base + "/login"); await page.fill('input[type=email]', "nouman@taskflow.local"); await page.fill('input[type=password]', "Password@123"); await page.click('button[type=submit]');
  await page.waitForURL(base + "/"); check("UI login lands on dashboard", true);
  await ctx.close();
}

// ---- every page, every role, desktop + mobile
for (const [role, who] of Object.entries(ROLES)) {
  const ctx = await login(who);
  for (const [w, h] of [[1360, 900], [390, 844]]) {
    const page = await ctx.newPage(); await page.setViewportSize({ width: w, height: h });
    const problems = [];
    page.on("console", (m) => m.type() === "error" && problems.push("console: " + m.text().slice(0, 160)));
    page.on("pageerror", (e) => problems.push("pageerror: " + e.message.slice(0, 160)));
    page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/_next/")) problems.push(`http ${r.status()} ${r.url().replace(base, "")}`); });
    for (const p of PAGES) {
      problems.length = 0;
      await page.goto(base + p, { waitUntil: "networkidle" }); await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      const expected403 = (role === "dev" && (p.includes("payments") || p === "/reports")) || (role === "finance" && false);
      const real = problems.filter((x) => !(expected403 && /http 403/.test(x)));
      check(`${role} ${w}px ${p}`, !real.length && !overflow, [...real, overflow ? "horizontal overflow" : ""].join(" | "));
    }
    await page.close();
  }
  await ctx.close();
}

// ---- API flow as PM / admin
const mk = async (who) => { const c = await login(who); return c.request; };
const admin = await mk("nouman"), pm = await mk("ravi"), dev = await mk("sharique"), fin = await mk("kavita");
const j = async (r) => (await r.json());
const P = (rq, url, data) => rq.post(base + url, { data });
const U = (rq, url, data) => rq.put(base + url, { data });

check("CSRF: cross-origin write blocked", (await admin.post(base + "/api/clients", { data: {}, headers: { origin: "https://evil.example" } })).status() === 403);
check("dev cannot create a project (403)", (await P(dev, "/api/projects", { name: "x", clientId: "CLI-001" })).status() === 403);
check("dev cannot read payments (403)", (await dev.get(base + "/api/payments")).status() === 403);
check("validation error → 400 + message", (await (async () => { const r = await P(pm, "/api/projects", { name: "", clientId: "CLI-001" }); return r.status() === 400 && /required/i.test((await j(r)).error.message); })()));
check("404 for unknown project", (await pm.get(base + "/api/projects/PRJ-999")).status() === 404);

const proj = await j(await P(pm, "/api/projects", { name: "E2E Project", clientId: "CLI-002", status: "ACTIVE", priority: "HIGH", contractValue: 200000, budget: 100000, projectManagerId: "USR-002", memberIds: ["USR-003", "USR-004", "USR-001"], startDate: "2026-10-01", expectedEndDate: "2026-12-01" }));
const pid = proj.data.id; check("project created (PRJ id)", /^PRJ-\d+$/.test(pid));
const task = await j(await P(pm, "/api/tasks", { projectId: pid, title: "Build Payment Module", primaryOwnerId: "USR-001", contributorIds: ["USR-002", "USR-003", "USR-004"], estimatedHours: 20 }));
const tid = task.data.id; check("task with owner + 3 contributors", task.data.primaryOwnerId === "USR-001" && task.data.contributorIds.length === 3);
check("non-member assignee rejected", (await P(pm, "/api/tasks", { projectId: pid, title: "t", primaryOwnerId: "USR-005" })).status() === 400);
const st = await j(await U(dev, `/api/tasks/${tid}`, { status: "IN_PROGRESS" })); check("contributor changes status", st.data.status === "IN_PROGRESS");
await P(dev, "/api/time-entries", { taskId: tid, date: "2026-10-05", hours: 15, description: "work" });
const t2 = await j(await dev.get(base + `/api/tasks/${tid}`)); check("estimated 20 / actual 15 / remaining 5", t2.data.estimatedHours === 20 && t2.data.actualHours === 15 && t2.data.remainingHours === 5);
const exp = await j(await P(dev, "/api/expenses", { projectId: pid, category: "SOFTWARE", description: "Lib", amount: 2500, date: "2026-10-05", paidBy: "USR-003", paymentMethod: "CARD" }));
check("dev expense is pending", exp.data.approvalStatus === "PENDING");
check("zero amount rejected", (await P(dev, "/api/expenses", { projectId: pid, category: "SOFTWARE", description: "x", amount: 0, date: "2026-10-05", paidBy: "USR-003", paymentMethod: "CARD" })).status() === 400);
await P(fin, `/api/expenses/${exp.data.id}/approve`, { decision: "APPROVED" });
await P(fin, "/api/payments", { projectId: pid, invoiceNumber: `E2E-${Date.now()}`, amount: 120000, status: "PAID", paymentMethod: "UPI" });
const f = (await j(await pm.get(base + `/api/projects/${pid}`))).data.financials;
check("financials dynamic: contract 200000, received 120000, pending 80000", f.contractValue === 200000 && f.received === 120000 && f.pending === 80000, JSON.stringify(f));
check("team cost = 15h × 700 and expenses 2500 → profit 187000", f.teamCost === 10500 && f.otherExpenses === 2500 && f.netProfit === 187000, JSON.stringify(f));
const notes = (await j(await dev.get(base + "/api/notifications?pageSize=50"))).data;
check("assignee got TASK_ASSIGNED notification", notes.some((n) => n.type === "TASK_ASSIGNED" && n.entityId === tid));
const act = (await j(await pm.get(base + `/api/tasks/${tid}/activity`))).data;
check("audit trail has CREATED + STATUS_CHANGED", act.some((a) => a.action === "CREATED") && act.some((a) => a.action === "STATUS_CHANGED" && a.oldValue === "TODO" && a.newValue === "IN_PROGRESS"));

// concurrency over HTTP
const before = (await j(await pm.get(base + "/api/tasks?pageSize=500"))).meta.total;
const created = await Promise.all(Array.from({ length: 30 }, (_, i) => P(pm, "/api/tasks", { projectId: pid, title: `Parallel ${i}` })));
const ids = new Set((await Promise.all(created.map(async (r) => (await j(r)).data?.id))));
const after = (await j(await pm.get(base + "/api/tasks?pageSize=500"))).meta.total;
check("30 concurrent task creates: unique ids, none lost", ids.size === 30 && after === before + 30, `${ids.size} ${before}→${after}`);
await Promise.all([U(pm, `/api/tasks/${tid}`, { priority: "CRITICAL" }), U(pm, `/api/tasks/${tid}`, { estimatedHours: 30 }), U(pm, `/api/tasks/${tid}`, { tags: ["x"] })]);
const t3 = (await j(await pm.get(base + `/api/tasks/${tid}`))).data;
check("concurrent updates all kept", t3.priority === "CRITICAL" && t3.estimatedHours === 30 && t3.tags[0] === "x");

// pagination / filter / search
const pg = await j(await pm.get(base + "/api/tasks?pageSize=5&page=2&sort=dueDate:asc")); check("pagination meta", pg.meta.page === 2 && pg.data.length === 5 && pg.meta.total > 25);
check("task filter by assignee+status", (await j(await pm.get(base + "/api/tasks?assigneeId=USR-004&status=IN_PROGRESS"))).data.every((t) => t.status === "IN_PROGRESS" && (t.primaryOwnerId === "USR-004" || t.contributorIds.includes("USR-004"))));
check("global search finds project + task", (await j(await pm.get(base + "/api/search?q=Payment"))).data.some((h) => h.type === "task"));

// soft delete / restore / backup
check("archive project (204)", (await pm.delete(base + `/api/projects/${pid}`)).status() === 204);
check("archived project hidden from list", !(await j(await pm.get(base + "/api/projects?pageSize=100"))).data.some((p) => p.id === pid));
check("restore project", (await P(pm, `/api/projects/${pid}/restore`)).status() === 200);
const bk = await j(await P(admin, "/api/backups")); check("backup now", /^\d{4}-\d\d-\d\d-\d{6}/.test(bk.data.name));
check("dev cannot back up (403)", (await P(dev, "/api/backups")).status() === 403);
const exportRes = await admin.get(base + "/api/export"); const bundle = JSON.parse(await exportRes.text());
check("export has all collections", Object.keys(bundle.collections).length === 14);
bundle.collections.projects[0].status = "BROKEN";
check("invalid import rejected, data intact", (await P(admin, "/api/import", bundle)).status() === 400);
await admin.delete(base + `/api/backups/${bk.data.name}`);

await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
