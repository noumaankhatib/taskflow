# TaskFlow — internal freelancing project & task tracker

Projects, tasks (Kanban), time tracking, expenses, client payments and live project profitability for a small team.
Next.js 16 · React 19 · TypeScript · Tailwind v4 · Zod · JSON files as the V1 data store (no database).

## Run it

```bash
npm install
npm run dev          # http://localhost:3000 — demo data is seeded automatically on first run
```

Sign in with any demo account (password `Password@123`):

| Role | Email |
| --- | --- |
| Admin | nouman@taskflow.local |
| Project Manager | ravi@taskflow.local |
| Developer | sharique@taskflow.local |
| Designer | priya@taskflow.local |
| QA | arjun@taskflow.local |
| Finance | kavita@taskflow.local |

Other commands: `npm run seed:force` (reset demo data), `npm test`, `npm run typecheck`, `npm run build && npm start`.
In production nothing is auto-seeded: run `npm run seed` once, or create the first admin yourself, then **change the demo passwords**.
Copy `.env.example` for options (`COOKIE_SECURE=true` behind HTTPS, `SESSION_SECRET`, data/backup locations).

## Architecture

```
Browser ──fetch──▶ /api route handler ──▶ Service ──▶ Repository (interface) ──▶ JsonRepository ──▶ JsonFileStore ──▶ data/*.json
(React UI)         auth · CSRF · Zod      business    storage-agnostic            one class per file    queue · atomic write
                   error mapping          rules       contract
```

* The UI never reads or writes JSON. It only calls `/api/*` (`src/lib/api.ts`).
* `src/services/container.ts` is the **only** place that picks the repository implementation. To move to PostgreSQL, implement the
  interfaces in `src/repositories/interfaces/` (`Repository<T>`, `StorageAdmin`) and change two lines there — services, API and UI are untouched.
* Layout: `src/app` (pages + API) · `src/modules/<feature>` (service + UI components) · `src/services` (cross-cutting services) ·
  `src/repositories/{interfaces,json}` · `src/schemas` (Zod) · `src/utils` · `src/components/ui` (design kit) · `src/seed`.

### Safe JSON storage (`src/repositories/json/JsonFileStore.ts`)

* Per-file **write queue**: every read-modify-write is serialized, so concurrent requests cannot overwrite each other. Ids (`TASK-014`) are
  assigned *inside* the lock, so concurrent creates never collide.
* **Atomic writes**: temp file → fsync → verify parses → copy current to `.bak` → `rename` over the target.
* **Validation before write** with the entity's Zod schema; invalid data is never persisted.
* **Recovery**: a corrupt file is restored from its `.bak` automatically (the corrupt copy is kept as `*.corrupt-<ts>`).
* Limits (by design for V1): one Node process, no cross-file transactions (multi-file operations such as "create task + assignees"
  are sequential writes), whole-file rewrite per change. Fine for a small team; the repository seam exists for when it isn't.

### Domain rules worth knowing

* **Money is derived, never stored.** Per project: `Net Profit = Contract Value − (Team Cost + Approved Expenses)`,
  `Margin = Net Profit ÷ Contract Value`. *Received* = paid invoices + partial amounts; *Pending* = Contract − Received.
  *Team cost* = Σ logged hours × the member's current hourly rate (daily rate ÷ 8 if no hourly rate). Pay rates therefore apply retroactively.
  All amounts are treated as one currency (INR by default); no FX conversion.
* **Expenses** by members who cannot approve start as *Pending* and don't count toward cost until a PM/Finance/Admin approves. Editing an
  approved expense as a non-approver sends it back to Pending.
* **Tasks** have one *primary owner* plus any number of *contributors* (`task-assignees.json`). Assignees must be active members of the
  task's project. Actual hours come from time entries. Overdue / project health ("At risk", "Delayed") are computed, not stored.
* **Soft delete** (`isDeleted/deletedAt/deletedBy`) for projects, tasks, expenses, payments and users, with restore. Archiving a project
  hides its tasks/expenses/payments everywhere; restoring brings them back. A backup is taken before a project is archived.
* **Audit trail** (`activity.json`): created/updated/deleted/restored, status changes, assignment changes, expenses, payments, comments, time.
* **Notifications** are generic (`entityType` + `entityId`). Overdue task / payment alerts are generated lazily (throttled) when users open
  the app, since V1 has no scheduler.
* **Auth**: bcrypt-hashed passwords, signed httpOnly session cookie (8 h), re-validated against the user record on every request (disabling
  a user or changing their password invalidates sessions immediately), login lock-out after 5 bad attempts/minute, same-origin check on writes.
* **RBAC** (`src/utils/rbac.ts`): Admin everything · Project Manager projects/tasks/expenses+approval/finance view/reports · Developer/Designer/QA
  own tasks, time, comments, submit expenses · Finance expenses, payments, reports · Viewer read-only. Enforced in services (the UI only hides buttons).

### Backups

`backups/<yyyy-mm-dd-hhmmss>/` holds a full snapshot + `manifest.json`. Created manually (Settings → Data & backups), and automatically before
archiving a project, restoring a backup, or importing data (last 30 kept). Export downloads one JSON bundle; import/restore validate every row of
every collection **before** replacing anything and refuse bundles with no active admin. Uploaded files (`data/uploads/`) are not part of backups.

## Tests

`npm test` — storage (concurrent writes, atomicity, corruption recovery), projects/tasks/assignees/status/permissions, expenses & approval,
payments, profit calculation, notifications, auth, backup/restore/import, dashboard.
