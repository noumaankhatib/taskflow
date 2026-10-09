import path from "node:path";
import { COLLECTIONS, type CollectionName } from "@/schemas/entities";
import type { Repositories } from "../interfaces";
import type { TaskAssignee, Notification } from "@/schemas/entities";
import { JsonFileStore } from "./JsonFileStore";
import { JsonRepository } from "./JsonRepository";
import { paths } from "@/utils/config";

type StoreMap = { [K in CollectionName]: JsonFileStore<(typeof COLLECTIONS)[K]["schema"]["_output"]> };

/** Stores are process-wide singletons (kept on globalThis so Next.js bundle duplication can't create two queues). */
const g = globalThis as unknown as { __jsonStores?: Map<string, StoreMap> };

export function getStores(dataDir = paths.data): StoreMap {
  g.__jsonStores ??= new Map();
  let m = g.__jsonStores.get(dataDir);
  if (!m) {
    m = Object.fromEntries(
      (Object.keys(COLLECTIONS) as CollectionName[]).map((k) => [
        k,
        new JsonFileStore(path.join(dataDir, COLLECTIONS[k].file), COLLECTIONS[k].schema as never),
      ]),
    ) as unknown as StoreMap;
    g.__jsonStores.set(dataDir, m);
  }
  return m;
}

class JsonTaskAssigneeRepository extends JsonRepository<TaskAssignee> {
  replaceForTask(taskId: string, primary: string | null, contributors: string[]) {
    return this.store.mutate((rows) => {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].taskId === taskId) rows.splice(i, 1);
      const now = new Date().toISOString();
      const want: [string, "PRIMARY" | "CONTRIBUTOR"][] = [];
      if (primary) want.push([primary, "PRIMARY"]);
      for (const c of new Set(contributors)) if (c !== primary) want.push([c, "CONTRIBUTOR"]);
      const out: TaskAssignee[] = [];
      for (const [userId, role] of want) {
        const id = `TAS-${String(rows.reduce((m, r) => Math.max(m, Number(r.id.slice(4))), 0) + 1).padStart(3, "0")}`;
        const row: TaskAssignee = { id, taskId, userId, role, createdAt: now, updatedAt: now };
        rows.push(row);
        out.push(row);
      }
      return out;
    });
  }
}

class JsonNotificationRepository extends JsonRepository<Notification> {
  markAllRead(userId: string) {
    return this.store.mutate((rows) => {
      let n = 0;
      const now = new Date().toISOString();
      for (const r of rows) {
        if (r.userId !== userId || r.isRead) continue;
        r.isRead = true;
        r.updatedAt = now;
        n++;
      }
      return n;
    });
  }
}

export function createJsonRepositories(dataDir = paths.data): Repositories {
  const s = getStores(dataDir);
  const P = (k: CollectionName) => COLLECTIONS[k].prefix;
  return {
    users: new JsonRepository(s.users, P("users")),
    clients: new JsonRepository(s.clients, P("clients")),
    projects: new JsonRepository(s.projects, P("projects")),
    projectMembers: new JsonRepository(s.projectMembers, P("projectMembers")),
    tasks: new JsonRepository(s.tasks, P("tasks")),
    taskAssignees: new JsonTaskAssigneeRepository(s.taskAssignees, P("taskAssignees")),
    subtasks: new JsonRepository(s.subtasks, P("subtasks")),
    timeEntries: new JsonRepository(s.timeEntries, P("timeEntries")),
    expenses: new JsonRepository(s.expenses, P("expenses")),
    payments: new JsonRepository(s.payments, P("payments")),
    comments: new JsonRepository(s.comments, P("comments")),
    notifications: new JsonNotificationRepository(s.notifications, P("notifications")),
    activity: new JsonRepository(s.activity, P("activity")),
    attachments: new JsonRepository(s.attachments, P("attachments")),
  };
}

export function createJsonStorageAdmin(dataDir = paths.data): import("../interfaces").StorageAdmin {
  const s = getStores(dataDir) as unknown as Record<string, JsonFileStore<unknown>>;
  return {
    readAll: (name) => s[name].read(),
    replaceAll: (name, rows) => s[name].replaceAll(rows),
    async replaceMany(data) {
      for (const [name, rows] of Object.entries(data)) await s[name].replaceAll(rows);
    },
  };
}
