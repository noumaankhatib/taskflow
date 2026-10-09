import { createInfra, type Infra } from "@/repositories/infra";
import { ActivityService } from "./ActivityService";
import { NotificationService } from "./NotificationService";
import { AlertService } from "./AlertService";
import { AttachmentService } from "./AttachmentService";
import { BackupService } from "./BackupService";
import { DashboardService } from "./DashboardService";
import { ReportService } from "./ReportService";
import { SearchService } from "./SearchService";
import { AuthService, UserService } from "@/modules/users/user.service";
import { ClientService } from "@/modules/clients/client.service";
import { ProjectService } from "@/modules/projects/project.service";
import { TaskService } from "@/modules/tasks/task.service";
import { TimeEntryService } from "@/modules/time/time.service";
import { ExpenseService } from "@/modules/expenses/expense.service";
import { PaymentService } from "@/modules/payments/payment.service";
import { paths } from "@/utils/config";

/** Composition root. The ONLY place that knows which repository implementation is used. */
export function createServices({ repos, storage, backupStore, files }: Infra) {
  const activity = new ActivityService(repos);
  const notifications = new NotificationService(repos);
  const deps = { repos, activity, notifications };
  const backups = new BackupService(deps, storage, backupStore);
  const projects = new ProjectService(deps, () => backups);
  const tasks = new TaskService(deps);
  const expenses = new ExpenseService(deps);
  const payments = new PaymentService(deps);
  return {
    repos, activity, notifications, backups, projects, tasks, expenses, payments,
    auth: new AuthService(deps),
    users: new UserService(deps),
    clients: new ClientService(deps),
    time: new TimeEntryService(deps),
    attachments: new AttachmentService(deps, files),
    alerts: new AlertService(deps),
    search: new SearchService(deps),
    dashboard: new DashboardService(deps, projects, tasks, expenses, payments),
    reports: new ReportService(deps, projects),
  };
}
export type Services = ReturnType<typeof createServices>;

const g = globalThis as unknown as { __services?: Map<string, Promise<Services>> };

/**
 * Process-wide services. The backend is chosen from the environment (see createInfra):
 * DATABASE_URL → Postgres (+ Vercel Blob), otherwise local JSON files.
 */
export function getServices(): Promise<Services> {
  g.__services ??= new Map();
  const key = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? paths.data;
  let s = g.__services.get(key);
  if (!s) {
    s = createInfra().then(createServices);
    g.__services.set(key, s);
    s.catch(() => g.__services?.delete(key)); // allow a retry after a transient connection failure
  }
  return s;
}
