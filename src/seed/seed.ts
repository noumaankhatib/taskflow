import bcrypt from "bcryptjs";
import { COLLECTIONS, type CollectionName } from "@/schemas/entities";
import type { StorageAdmin } from "@/repositories/interfaces";

export const DEMO_PASSWORD = "Password@123";

const NOW = () => new Date();
/** yyyy-mm-dd, `n` days from today (negative = past). */
const day = (n: number) => new Date(NOW().getTime() + n * 86400_000).toISOString().slice(0, 10);
/** ISO timestamp `n` days from now at a given hour. */
const at = (n: number, hour = 10, min = 0) => {
  const d = new Date(NOW().getTime() + n * 86400_000);
  d.setUTCHours(hour, min, 0, 0);
  return d.toISOString();
};
const pad = (p: string, n: number) => `${p}-${String(n).padStart(3, "0")}`;

const U = {
  nouman: "USR-001", ravi: "USR-002", sharique: "USR-003", priya: "USR-004", arjun: "USR-005", kavita: "USR-006",
};
const NAME: Record<string, string> = {
  [U.nouman]: "Nouman", [U.ravi]: "Ravi", [U.sharique]: "Sharique", [U.priya]: "Priya", [U.arjun]: "Arjun", [U.kavita]: "Kavita",
};

type Status = "BACKLOG" | "TODO" | "IN_PROGRESS" | "BLOCKED" | "REVIEW" | "COMPLETED" | "CANCELLED";
interface T {
  p: number; title: string; desc: string; status: Status; prio: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  owner: string; contrib?: string[]; est: number; start: number | null; due: number | null; tags?: string[];
  spent?: [string, number][]; created: number; done?: number; by?: string;
}

const TASKS: T[] = [
  // PRJ-001 Acme Storefront Revamp
  { p: 1, title: "Design new storefront homepage", desc: "Hero, category tiles, trust badges and mobile layouts in Figma.", status: "COMPLETED", prio: "HIGH", owner: U.priya, contrib: [U.ravi], est: 24, start: -55, due: -35, tags: ["design", "ui"], spent: [[U.priya, 22], [U.ravi, 3]], created: -58, done: -36 },
  { p: 1, title: "Set up Next.js storefront project", desc: "Repo, CI, lint rules, environments and base layout.", status: "COMPLETED", prio: "MEDIUM", owner: U.sharique, est: 8, start: -55, due: -45, tags: ["frontend", "setup"], spent: [[U.sharique, 7]], created: -58, done: -46 },
  { p: 1, title: "Build product listing & filters", desc: "Category pages with faceted filters, sorting and pagination.", status: "REVIEW", prio: "HIGH", owner: U.sharique, contrib: [U.priya], est: 30, start: -40, due: -3, tags: ["frontend"], spent: [[U.sharique, 22], [U.priya, 5]], created: -45 },
  { p: 1, title: "Build Payment Module", desc: "Razorpay checkout, webhooks, refunds and order reconciliation.", status: "IN_PROGRESS", prio: "CRITICAL", owner: U.nouman, contrib: [U.ravi, U.sharique, U.priya], est: 40, start: -20, due: 6, tags: ["payments", "backend"], spent: [[U.nouman, 10], [U.ravi, 3], [U.sharique, 12], [U.priya, 4]], created: -25 },
  { p: 1, title: "Integrate shipping rate API", desc: "Live courier rates at checkout with pincode serviceability.", status: "TODO", prio: "MEDIUM", owner: U.sharique, est: 12, start: 2, due: 12, tags: ["backend", "integration"], created: -10 },
  { p: 1, title: "QA: checkout regression suite", desc: "Playwright suite for cart → payment → order confirmation.", status: "TODO", prio: "HIGH", owner: U.arjun, est: 16, start: 8, due: 18, tags: ["qa"], created: -8 },
  { p: 1, title: "Migrate product catalogue data", desc: "Import 2,400 SKUs from the legacy CSV exports. Waiting on cleaned data from client.", status: "BLOCKED", prio: "HIGH", owner: U.sharique, est: 10, start: -14, due: -2, tags: ["data"], spent: [[U.sharique, 4]], created: -20 },
  { p: 1, title: "SEO & performance tuning", desc: "Core Web Vitals pass, schema markup, sitemap.", status: "BACKLOG", prio: "LOW", owner: U.ravi, est: 14, start: null, due: null, tags: ["seo", "performance"], created: -6 },
  // PRJ-002 BlueOrbit Fleet Tracking
  { p: 2, title: "Requirements & architecture document", desc: "Fleet data model, telemetry ingestion and role matrix.", status: "COMPLETED", prio: "HIGH", owner: U.ravi, est: 12, start: -44, due: -38, tags: ["planning"], spent: [[U.ravi, 11]], created: -46, done: -39 },
  { p: 2, title: "Build Authentication", desc: "JWT-based auth for dispatchers and drivers.", status: "IN_PROGRESS", prio: "HIGH", owner: U.sharique, contrib: [U.nouman], est: 20, start: -30, due: -4, tags: ["backend", "security"], spent: [[U.sharique, 17], [U.nouman, 4]], created: -35 },
  { p: 2, title: "Live vehicle map dashboard", desc: "Realtime map with clustering, trails and vehicle status.", status: "IN_PROGRESS", prio: "CRITICAL", owner: U.sharique, contrib: [U.priya], est: 36, start: -18, due: 5, tags: ["frontend", "maps"], spent: [[U.sharique, 20], [U.priya, 8]], created: -22 },
  { p: 2, title: "Driver mobile check-in API", desc: "Check-in/out, trip start and proof of delivery endpoints.", status: "REVIEW", prio: "HIGH", owner: U.nouman, contrib: [U.sharique], est: 18, start: -16, due: 2, tags: ["backend", "mobile"], spent: [[U.nouman, 14], [U.sharique, 3]], created: -20 },
  { p: 2, title: "Design dashboard UI kit", desc: "Component library and dark mode for ops dashboard.", status: "COMPLETED", prio: "MEDIUM", owner: U.priya, est: 20, start: -35, due: -15, tags: ["design"], spent: [[U.priya, 22]], created: -38, done: -16 },
  { p: 2, title: "Geofence alerts", desc: "Polygon geofences with entry/exit alerts via email and SMS.", status: "TODO", prio: "HIGH", owner: U.sharique, est: 16, start: 3, due: 9, tags: ["backend"], created: -9 },
  { p: 2, title: "Reports & CSV export", desc: "Trip, idle-time and fuel reports with scheduled exports.", status: "TODO", prio: "MEDIUM", owner: U.nouman, est: 14, start: 6, due: 14, tags: ["reports"], created: -9 },
  { p: 2, title: "Load & security testing", desc: "10k-vehicle load profile, OWASP checklist.", status: "TODO", prio: "HIGH", owner: U.arjun, est: 20, start: 10, due: 16, tags: ["qa", "security"], created: -7 },
  { p: 2, title: "Legacy GPS vendor integration", desc: "Dropped: client moved to the new telematics vendor.", status: "CANCELLED", prio: "LOW", owner: U.nouman, est: 10, start: null, due: null, tags: ["integration"], created: -30 },
  // PRJ-003 Greenleaf Mobile Ordering
  { p: 3, title: "Discovery workshop & user flows", desc: "Stakeholder interviews and primary ordering journeys.", status: "COMPLETED", prio: "MEDIUM", owner: U.priya, contrib: [U.ravi], est: 10, start: -10, due: -3, tags: ["discovery"], spent: [[U.priya, 9], [U.ravi, 3]], created: -12, done: -4 },
  { p: 3, title: "Menu & ordering UX wireframes", desc: "Low-fi wireframes for menu browsing, cart and reorder.", status: "IN_PROGRESS", prio: "MEDIUM", owner: U.priya, est: 22, start: -3, due: 8, tags: ["design", "ux"], spent: [[U.priya, 12]], created: -5 },
  { p: 3, title: "Tech stack evaluation", desc: "React Native vs Flutter spike with offline ordering prototype.", status: "TODO", prio: "LOW", owner: U.sharique, est: 6, start: 1, due: 5, tags: ["research"], created: -4 },
  // PRJ-004 Acme Brand Identity
  { p: 4, title: "Brand audit & moodboards", desc: "Audit existing collateral, three moodboard directions.", status: "COMPLETED", prio: "MEDIUM", owner: U.priya, est: 16, start: -115, due: -100, tags: ["branding"], spent: [[U.priya, 15]], created: -118, done: -101 },
  { p: 4, title: "Logo & colour palette", desc: "Primary/secondary marks, accessibility-checked palette.", status: "COMPLETED", prio: "HIGH", owner: U.priya, est: 24, start: -100, due: -80, tags: ["branding", "design"], spent: [[U.priya, 26]], created: -102, done: -79 },
  { p: 4, title: "Typography & icon set", desc: "Type scale and 80-icon set.", status: "COMPLETED", prio: "MEDIUM", owner: U.priya, est: 18, start: -80, due: -55, tags: ["design"], spent: [[U.priya, 17]], created: -82, done: -56 },
  { p: 4, title: "Design system documentation", desc: "Foundations, components and usage guidelines.", status: "COMPLETED", prio: "MEDIUM", owner: U.priya, contrib: [U.ravi], est: 20, start: -55, due: -30, tags: ["documentation"], spent: [[U.priya, 18], [U.ravi, 3]], created: -57, done: -31 },
  { p: 4, title: "Brand guidelines handoff", desc: "Final PDF + source files to client.", status: "COMPLETED", prio: "LOW", owner: U.ravi, est: 6, start: -30, due: -20, tags: ["handoff"], spent: [[U.ravi, 5]], created: -32, done: -21 },
];

const SUBTASKS: Record<number, [string, boolean][]> = {
  10: [["Create login API", true], ["Create JWT middleware", true], ["Create refresh token API", true], ["Add logout API", false], ["Add tests", false]],
  4: [["Razorpay order creation API", true], ["Checkout UI integration", true], ["Webhook signature verification", false], ["Refund flow", false]],
  11: [["Map tile provider setup", true], ["Marker clustering", false], ["Vehicle trail playback", false]],
};

export function buildSeed(passwordHash: string): Record<CollectionName, unknown[]> {
  const stamp = (n: number, h = 9) => at(n, h);

  const users = [
    ["Nouman Khatib", "nouman", "ADMIN", 900, 7200], ["Ravi Sharma", "ravi", "PROJECT_MANAGER", 800, 6400],
    ["Sharique Ahmed", "sharique", "DEVELOPER", 700, 5600], ["Priya Nair", "priya", "DESIGNER", 650, 5200],
    ["Arjun Mehta", "arjun", "QA", 450, 3600], ["Kavita Rao", "kavita", "FINANCE", 500, 4000],
  ].map(([name, handle, role, hourly, daily], i) => ({
    id: pad("USR", i + 1), name, email: `${handle}@taskflow.local`, role, avatar: null, hourlyRate: hourly, dailyRate: daily,
    active: true, passwordHash, isDeleted: false, deletedAt: null, deletedBy: null, createdAt: stamp(-130), updatedAt: stamp(-130),
  }));

  const clients = [
    ["Acme Retail Pvt Ltd", "Meera Kapoor", "meera@acmeretail.example", "+91 98200 11001", "12 Linking Road, Bandra West, Mumbai 400050", "Prefers WhatsApp updates; pays on milestones."],
    ["BlueOrbit Logistics", "Rahul Verma", "rahul.verma@blueorbit.example", "+91 98110 22002", "Plot 44, Sector 18, Gurugram 122015", "Needs weekly Friday status calls."],
    ["Greenleaf Foods", "Anita Desai", "anita@greenleaf.example", "+91 98450 33003", "7 Indiranagar 100ft Rd, Bengaluru 560038", "New client, referred by Acme."],
  ].map(([companyName, contactPerson, email, phone, address, notes], i) => ({
    id: pad("CLI", i + 1), companyName, contactPerson, email, phone, address, notes, active: true, createdAt: stamp(-125), updatedAt: stamp(-125),
  }));

  const P = [
    { name: "Acme Storefront Revamp", client: 1, status: "ACTIVE", prio: "HIGH", start: -60, end: 30, actual: null, budget: 150000, contract: 200000, pm: U.ravi, members: [U.nouman, U.ravi, U.sharique, U.priya, U.arjun], desc: "Rebuild Acme's e-commerce storefront with a faster checkout, new design and catalogue migration." },
    { name: "BlueOrbit Fleet Tracking Portal", client: 2, status: "ACTIVE", prio: "CRITICAL", start: -46, end: 10, actual: null, budget: 320000, contract: 450000, pm: U.ravi, members: [U.nouman, U.ravi, U.sharique, U.priya, U.arjun], desc: "Realtime fleet tracking portal with geofencing, driver app APIs and reporting." },
    { name: "Greenleaf Mobile Ordering App", client: 3, status: "PLANNING", prio: "MEDIUM", start: -12, end: 90, actual: null, budget: 240000, contract: 320000, pm: U.nouman, members: [U.nouman, U.ravi, U.sharique, U.priya], desc: "Cross-platform mobile app for restaurant ordering, loyalty and reorders." },
    { name: "Acme Brand Identity & Design System", client: 1, status: "COMPLETED", prio: "LOW", start: -120, end: -20, actual: -15, budget: 80000, contract: 120000, pm: U.ravi, members: [U.ravi, U.priya], desc: "New brand identity, typography and a reusable design system for Acme." },
  ];
  const projects = P.map((p, i) => ({
    id: pad("PRJ", i + 1), name: p.name, clientId: pad("CLI", p.client), description: p.desc, status: p.status, priority: p.prio,
    startDate: day(p.start), expectedEndDate: day(p.end), actualEndDate: p.actual === null ? null : day(p.actual),
    budget: p.budget, contractValue: p.contract, createdBy: U.nouman, projectManagerId: p.pm,
    isDeleted: false, deletedAt: null, deletedBy: null, createdAt: stamp(p.start - 3), updatedAt: stamp(-1),
  }));
  let pmbN = 0;
  const projectMembers = P.flatMap((p, i) =>
    p.members.map((userId) => ({ id: pad("PMB", ++pmbN), projectId: pad("PRJ", i + 1), userId, createdAt: stamp(p.start - 3), updatedAt: stamp(p.start - 3) })),
  );

  const tasks = TASKS.map((t, i) => ({
    id: pad("TASK", i + 1), projectId: pad("PRJ", t.p), title: t.title, description: t.desc, status: t.status, priority: t.prio,
    startDate: t.start === null ? null : day(t.start), dueDate: t.due === null ? null : day(t.due), estimatedHours: t.est,
    tags: t.tags ?? [], parentTaskId: null, createdBy: t.by ?? U.ravi, completedAt: t.status === "COMPLETED" ? stamp(t.done ?? t.due ?? -1, 16) : null,
    isDeleted: false, deletedAt: null, deletedBy: null, createdAt: stamp(t.created), updatedAt: stamp(t.done ?? Math.min(-1, t.created + 6), 12),
  }));
  let tasN = 0;
  const taskAssignees = TASKS.flatMap((t, i) =>
    [[t.owner, "PRIMARY"], ...(t.contrib ?? []).map((c) => [c, "CONTRIBUTOR"])].map(([userId, role]) => ({
      id: pad("TAS", ++tasN), taskId: pad("TASK", i + 1), userId, role, createdAt: stamp(t.created), updatedAt: stamp(t.created),
    })),
  );
  let subN = 0;
  const subtasks = Object.entries(SUBTASKS).flatMap(([taskNo, subs]) =>
    subs.map(([title, completed]) => ({
      id: pad("SUB", ++subN), taskId: pad("TASK", Number(taskNo)), title, completed, completedAt: completed ? stamp(-6, 15) : null, createdAt: stamp(-20), updatedAt: stamp(-6),
    })),
  );

  // time entries: spread each (user, hours) over working days ending at completion / yesterday
  const timeEntries: unknown[] = [];
  const descs = ["Implementation", "Code review & fixes", "Design iteration", "Client feedback changes", "Testing & bug fixes", "Planning & research"];
  TASKS.forEach((t, i) => {
    const endOffset = t.status === "COMPLETED" ? (t.done ?? t.due ?? -1) : -1;
    const startOffset = Math.min(t.start ?? endOffset - 6, endOffset);
    for (const [userId, hours] of t.spent ?? []) {
      let left = hours, d = endOffset, k = 0;
      while (left > 0.01) {
        const h = Math.min(left, [4, 5, 3, 6, 2.5][k % 5]);
        const date = Math.max(d, startOffset);
        timeEntries.push({
          id: pad("TIME", timeEntries.length + 1), taskId: pad("TASK", i + 1), projectId: pad("PRJ", t.p), userId, date: day(date),
          hours: h, description: descs[(i + k) % descs.length], billable: k % 6 !== 5, createdAt: stamp(date, 18), updatedAt: stamp(date, 18),
        });
        left -= h; d -= 1 + (k % 2); k++;
      }
    }
  });

  const E: [number, string, string, number, number, string, string, number, boolean][] = [
    // project, category, description, amount, daysAgo, paidBy, method, approver?, approved
    [1, "HOSTING", "Vercel Pro (3 months)", 5400, -50, U.sharique, "UPI", 0, true],
    [1, "DOMAIN", "acme-store.in domain (1 year)", 1200, -52, U.ravi, "CARD", 0, true],
    [1, "SOFTWARE", "Figma seats for Acme project", 6000, -48, U.priya, "CARD", 0, true],
    [1, "API", "Razorpay sandbox & setup fees", 2500, -30, U.nouman, "BANK_TRANSFER", 0, true],
    [1, "DESIGN", "Stock photography licence", 4800, -45, U.priya, "CARD", 0, true],
    [1, "MISCELLANEOUS", "Client workshop refreshments", 1100, -40, U.ravi, "CASH", 0, true],
    [2, "HOSTING", "AWS EC2 + RDS (staging, 2 months)", 18500, -25, U.sharique, "CARD", 0, true],
    [2, "API", "Google Maps Platform credits", 14200, -18, U.nouman, "CARD", 0, true],
    [2, "HARDWARE", "GPS test trackers (5 units)", 22500, -35, U.nouman, "BANK_TRANSFER", 0, true],
    [2, "TRAVEL", "Site visit to Pune warehouse", 7800, -28, U.ravi, "UPI", 0, true],
    [2, "SOFTWARE", "Sentry team plan", 3900, -10, U.sharique, "CARD", 0, false],
    [2, "TEAM", "Contract QA freelancer top-up", 12000, -12, U.arjun, "BANK_TRANSFER", 0, true],
    [3, "MARKETING", "Competitor app research subscriptions", 3200, -6, U.priya, "CARD", 0, false],
    [4, "SOFTWARE", "Brand typeface licence", 9500, -90, U.priya, "CARD", 0, true],
    [4, "DESIGN", "Icon pack commercial licence", 3600, -85, U.priya, "CARD", 0, true],
  ];
  const expenses = E.map(([p, category, description, amount, ago, paidBy, paymentMethod, , approved], i) => ({
    id: pad("EXP", i + 1), projectId: pad("PRJ", p), category, description, amount, currency: "INR", date: day(ago), paidBy, paymentMethod,
    attachmentId: null, notes: "", approvalStatus: approved ? "APPROVED" : "PENDING", approvedBy: approved ? U.kavita : null,
    createdBy: paidBy, isDeleted: false, deletedAt: null, deletedBy: null, createdAt: stamp(ago, 11), updatedAt: stamp(ago, 11),
  }));

  const payRows: [number, string, number, number, string, number, number | null, string | null][] = [
    [1, "INV-2026-001", 60000, 60000, "PAID", -50, -55, "BANK_TRANSFER"],
    [1, "INV-2026-004", 60000, 60000, "PAID", -15, -20, "UPI"],
    [1, "INV-2026-009", 80000, 0, "PENDING", 30, null, null],
    [2, "INV-2026-002", 135000, 135000, "PAID", -35, -40, "BANK_TRANSFER"],
    [2, "INV-2026-006", 135000, 70000, "PARTIALLY_PAID", -5, -9, "BANK_TRANSFER"],
    [2, "INV-2026-010", 180000, 0, "PENDING", 20, null, null],
    [4, "INV-2026-003", 60000, 60000, "PAID", -95, -98, "BANK_TRANSFER"],
    [4, "INV-2026-005", 60000, 60000, "PAID", -18, -22, "CHEQUE"],
  ];
  const payments = payRows.map(([p, invoiceNumber, amount, receivedAmount, status, due, paid, paymentMethod], i) => ({
    id: pad("PAY", i + 1), projectId: pad("PRJ", p), clientId: pad("CLI", P[p - 1].client), invoiceNumber, amount, receivedAmount, currency: "INR",
    paymentDate: paid === null ? null : day(paid), dueDate: day(due), paymentMethod, status,
    notes: status === "PARTIALLY_PAID" ? "Client paid ₹70,000; balance promised by month end." : "", createdBy: U.kavita,
    isDeleted: false, deletedAt: null, deletedBy: null, createdAt: stamp(Math.min(due, paid ?? due) - 5), updatedAt: stamp(paid ?? due),
  }));

  const C: [number, string, string, number][] = [
    [4, U.ravi, "@Sharique please make sure webhook retries are idempotent before we go live.", -8],
    [4, U.sharique, "On it. I'll add an idempotency key per order and cover it with tests.", -8],
    [4, U.priya, "Checkout modal states are in Figma (success, failure, pending). @Nouman let me know if you need more.", -6],
    [3, U.ravi, "Filters look good. @Sharique can you fix the sticky filter bar on mobile?", -4],
    [3, U.sharique, "Fixed in the latest commit, ready for review.", -3],
    [7, U.sharique, "Still waiting on the cleaned CSV from Acme. Blocked until they send it.", -5],
    [7, U.ravi, "I've pinged Meera again; she promised it by Thursday.", -4],
    [10, U.ravi, "Refresh token rotation is overdue, can we split it so login ships first?", -6],
    [11, U.priya, "New cluster marker designs attached to the Figma file.", -7],
    [12, U.nouman, "API is ready for review. @Ravi please check the proof-of-delivery payload.", -2],
    [12, U.ravi, "Reviewed, one comment on the timestamp format.", -1],
    [19, U.ravi, "Great start on the wireframes. Can we add a reorder shortcut on the home screen?", -2],
    [14, U.sharique, "Will start once the map dashboard is merged.", -3],
    [1, U.ravi, "Approved by the client with minor copy changes.", -37],
  ];
  const comments = C.map(([t, userId, message, ago], i) => ({
    id: pad("CMT", i + 1), taskId: pad("TASK", t), userId, message, createdAt: stamp(ago, 11 + (i % 6)), updatedAt: stamp(ago, 11 + (i % 6)),
  }));

  const N: [string, string, string, string, string, string, string, number, boolean][] = [
    [U.sharique, "MENTION", "Ravi mentioned you", 'On "Build Payment Module": @Sharique please make sure webhook retries are idempotent…', "INFO", "TASK", "TASK-004", -8, true],
    [U.sharique, "TASK_ASSIGNED", "Task assigned to you", 'Ravi assigned you "Geofence alerts".', "INFO", "TASK", "TASK-014", -9, false],
    [U.sharique, "TASK_OVERDUE", "Task overdue", '"Build Authentication" was due ' + "4 days ago.", "ERROR", "TASK", "TASK-010", -3, false],
    [U.nouman, "TASK_OVERDUE", "Task overdue", '"Build Authentication" was due 4 days ago.', "ERROR", "TASK", "TASK-010", -3, false],
    [U.nouman, "MENTION", "Priya mentioned you", 'On "Build Payment Module": checkout modal states are in Figma.', "INFO", "TASK", "TASK-004", -6, true],
    [U.nouman, "EXPENSE_ADDED", "Approval needed", "Sharique submitted ₹3,900 for BlueOrbit Fleet Tracking Portal.", "WARNING", "EXPENSE", "EXP-011", -10, false],
    [U.ravi, "APPROVAL_REQUIRED", "Expense needs approval", "Sharique submitted ₹3,900 for BlueOrbit Fleet Tracking Portal.", "WARNING", "EXPENSE", "EXP-011", -10, false],
    [U.ravi, "TASK_COMPLETED", "Task completed", '"Design dashboard UI kit" was marked complete by Priya.', "SUCCESS", "TASK", "TASK-013", -16, true],
    [U.ravi, "PAYMENT_PENDING", "Payment overdue", "INV-2026-006 (₹65,000) was due 5 days ago.", "WARNING", "PAYMENT", "PAY-005", -2, false],
    [U.kavita, "PAYMENT_PENDING", "Payment overdue", "INV-2026-006 (₹65,000) was due 5 days ago.", "WARNING", "PAYMENT", "PAY-005", -2, false],
    [U.kavita, "APPROVAL_REQUIRED", "Expense needs approval", "Priya submitted ₹3,200 for Greenleaf Mobile Ordering App.", "WARNING", "EXPENSE", "EXP-013", -6, false],
    [U.kavita, "PAYMENT_RECEIVED", "Payment received", "Nouman recorded ₹60,000 on INV-2026-004 (Acme Storefront Revamp).", "SUCCESS", "PAYMENT", "PAY-002", -20, true],
    [U.priya, "TASK_ASSIGNED", "New task assigned", 'Ravi assigned you "Menu & ordering UX wireframes".', "INFO", "TASK", "TASK-019", -5, true],
    [U.priya, "PROJECT_UPDATE", "Added to project Greenleaf Mobile Ordering App", "Nouman added you to Greenleaf Mobile Ordering App.", "INFO", "PROJECT", "PRJ-003", -12, true],
    [U.arjun, "TASK_ASSIGNED", "New task assigned", 'Ravi assigned you "QA: checkout regression suite".', "INFO", "TASK", "TASK-006", -8, false],
    [U.arjun, "SYSTEM_ALERT", "Reminder", "BlueOrbit load test environment is scheduled for next week.", "WARNING", "PROJECT", "PRJ-002", -1, false],
  ];
  const notifications = N.map(([userId, type, title, message, severity, entityType, entityId, ago, isRead], i) => ({
    id: pad("NTF", i + 1), userId, type, title, message, severity, entityType, entityId, isRead, createdAt: stamp(ago, 9 + (i % 8)), updatedAt: stamp(ago, 9 + (i % 8)),
  }));

  // audit trail derived from the seed itself
  const act: { entityType: string; entityId: string; projectId: string | null; action: string; userId: string; oldValue?: unknown; newValue?: unknown; message: string; at: string }[] = [];
  projects.forEach((p) => act.push({ entityType: "PROJECT", entityId: p.id, projectId: p.id, action: "CREATED", userId: U.nouman, message: `Nouman created project ${p.name}`, at: p.createdAt }));
  TASKS.forEach((t, i) => {
    const id = pad("TASK", i + 1), pid = pad("PRJ", t.p);
    act.push({ entityType: "TASK", entityId: id, projectId: pid, action: "CREATED", userId: t.by ?? U.ravi, message: `${NAME[t.by ?? U.ravi]} created task ${t.title}`, at: stamp(t.created) });
    act.push({ entityType: "TASK", entityId: id, projectId: pid, action: "ASSIGNMENT_CHANGED", userId: t.by ?? U.ravi, message: `${NAME[t.by ?? U.ravi]} assigned "${t.title}" to ${[t.owner, ...(t.contrib ?? [])].map((u) => NAME[u]).join(", ")}`, at: stamp(t.created, 10) });
    if (t.status !== "BACKLOG" && t.status !== "TODO") act.push({ entityType: "TASK", entityId: id, projectId: pid, action: "STATUS_CHANGED", userId: t.owner, oldValue: "TODO", newValue: "IN_PROGRESS", message: `${NAME[t.owner]} changed status from Todo → In Progress on "${t.title}"`, at: stamp((t.start ?? t.created) + 1, 10) });
    if (t.status === "COMPLETED") act.push({ entityType: "TASK", entityId: id, projectId: pid, action: "STATUS_CHANGED", userId: t.owner, oldValue: "REVIEW", newValue: "COMPLETED", message: `${NAME[t.owner]} changed status from Review → Completed on "${t.title}"`, at: stamp(t.done ?? t.due ?? -1, 16) });
    if (t.status === "REVIEW") act.push({ entityType: "TASK", entityId: id, projectId: pid, action: "STATUS_CHANGED", userId: t.owner, oldValue: "IN_PROGRESS", newValue: "REVIEW", message: `${NAME[t.owner]} changed status from In Progress → Review on "${t.title}"`, at: stamp(-2, 15) });
    if (t.status === "BLOCKED") act.push({ entityType: "TASK", entityId: id, projectId: pid, action: "STATUS_CHANGED", userId: t.owner, oldValue: "IN_PROGRESS", newValue: "BLOCKED", message: `${NAME[t.owner]} changed status from In Progress → Blocked on "${t.title}"`, at: stamp(-5, 14) });
  });
  comments.forEach((c) => act.push({ entityType: "COMMENT", entityId: c.id, projectId: pad("PRJ", TASKS[Number(c.taskId.slice(5)) - 1].p), action: "COMMENT_ADDED", userId: c.userId, message: `${NAME[c.userId]} added a comment on "${TASKS[Number(c.taskId.slice(5)) - 1].title}"`, at: c.createdAt }));
  expenses.forEach((e) => act.push({ entityType: "EXPENSE", entityId: e.id, projectId: e.projectId, action: "EXPENSE_ADDED", userId: e.createdBy, newValue: { amount: e.amount }, message: `${NAME[e.createdBy]} added expense ₹${e.amount.toLocaleString("en-IN")} (${e.description})`, at: e.createdAt }));
  payments.forEach((p) => act.push({ entityType: "PAYMENT", entityId: p.id, projectId: p.projectId, action: "PAYMENT_ADDED", userId: U.kavita, newValue: { amount: p.amount }, message: `Kavita added payment ${p.invoiceNumber} for ₹${p.amount.toLocaleString("en-IN")}`, at: p.createdAt }));
  act.sort((a, b) => a.at.localeCompare(b.at));
  const activity = act.map((a, i) => ({
    id: pad("ACT", i + 1), entityType: a.entityType, entityId: a.entityId, projectId: a.projectId, action: a.action, userId: a.userId,
    oldValue: a.oldValue ?? null, newValue: a.newValue ?? null, message: a.message, createdAt: a.at, updatedAt: a.at,
  }));

  return { users, clients, projects, projectMembers, tasks, taskAssignees, subtasks, timeEntries, expenses, payments, comments, notifications, activity, attachments: [] } as Record<CollectionName, unknown[]>;
}

/** Writes demo data. Without `force`, does nothing when users already exist. Returns true if seeded. */
export async function seed(storage: StorageAdmin, opts: { force?: boolean } = {}): Promise<boolean> {
  if (!opts.force && (await storage.readAll("users")).length > 0) return false;
  const data = buildSeed(await bcrypt.hash(DEMO_PASSWORD, 10));
  for (const k of Object.keys(COLLECTIONS) as CollectionName[]) {
    data[k] = data[k].map((r) => COLLECTIONS[k].schema.parse(r)); // fail loudly if seed violates the schema
  }
  for (const k of Object.keys(COLLECTIONS) as CollectionName[]) await storage.replaceAll(k, data[k]);
  return true;
}
