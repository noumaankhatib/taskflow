import type { Repositories, StorageAdmin } from "@/repositories/interfaces";
import { createJsonRepositories, createJsonStorageAdmin } from "@/repositories/json";
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
export function createServices(repos: Repositories, storage: StorageAdmin) {
  const activity = new ActivityService(repos);
  const notifications = new NotificationService(repos);
  const deps = { repos, activity, notifications };
  const backups = new BackupService(deps, storage);
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
    attachments: new AttachmentService(deps),
    alerts: new AlertService(deps),
    search: new SearchService(deps),
    dashboard: new DashboardService(deps, projects, tasks, expenses, payments),
    reports: new ReportService(deps, projects),
  };
}
export type Services = ReturnType<typeof createServices>;

const g = globalThis as unknown as { __services?: Map<string, Services> };

/** Process-wide services bound to the JSON implementation (swap here for PostgreSQL). */
export function getServices(): Services {
  g.__services ??= new Map();
  const key = paths.data;
  let s = g.__services.get(key);
  if (!s) {
    s = createServices(createJsonRepositories(), createJsonStorageAdmin());
    g.__services.set(key, s);
  }
  return s;
}
