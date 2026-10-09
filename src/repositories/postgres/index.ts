import { COLLECTIONS, type CollectionName, type Notification, type TaskAssignee } from "@/schemas/entities";
import type { Repositories, StorageAdmin } from "../interfaces";
import type { BackupInfo, BackupStore } from "../interfaces/infra";
import { backupStamp } from "../interfaces/infra";
import { PgRepository } from "./PgRepository";
import type { Db } from "./db";

class PgTaskAssigneeRepository extends PgRepository<TaskAssignee> {
  replaceForTask(taskId: string, primary: string | null, contributors: string[]) {
    return this.db.tx(async (q) => {
      await this.lock(q);
      await q.query("DELETE FROM records WHERE collection = $1 AND data->>'taskId' = $2", [this.collection, taskId]);
      const want: [string, "PRIMARY" | "CONTRIBUTOR"][] = [];
      if (primary) want.push([primary, "PRIMARY"]);
      for (const c of new Set(contributors)) if (c !== primary) want.push([c, "CONTRIBUTOR"]);
      let seq = await this.nextSeq(q);
      const now = new Date().toISOString();
      const out: TaskAssignee[] = [];
      for (const [userId, role] of want) {
        const row = this.parse({ id: `${this.prefix}-${String(seq).padStart(3, "0")}`, taskId, userId, role, createdAt: now, updatedAt: now });
        await this.insert(q, row, seq++);
        out.push(row);
      }
      return out;
    });
  }
}

class PgNotificationRepository extends PgRepository<Notification> {
  async markAllRead(userId: string) {
    await this.db.ready;
    const r = await this.db.query(
      `UPDATE records SET data = data || jsonb_build_object('isRead', true, 'updatedAt', $3::text)
        WHERE collection = $1 AND data->>'userId' = $2 AND data->>'isRead' = 'false'`,
      [this.collection, userId, new Date().toISOString()],
    );
    return r.rowCount;
  }
}

export function createPostgresRepositories(db: Db): Repositories {
  const R = <K extends CollectionName>(k: K) =>
    new PgRepository(db, k, COLLECTIONS[k].prefix, COLLECTIONS[k].schema as never) as PgRepository<never>;
  return {
    users: R("users"), clients: R("clients"), projects: R("projects"), projectMembers: R("projectMembers"), tasks: R("tasks"),
    taskAssignees: new PgTaskAssigneeRepository(db, "taskAssignees", COLLECTIONS.taskAssignees.prefix, COLLECTIONS.taskAssignees.schema),
    subtasks: R("subtasks"), timeEntries: R("timeEntries"), expenses: R("expenses"), payments: R("payments"), comments: R("comments"),
    notifications: new PgNotificationRepository(db, "notifications", COLLECTIONS.notifications.prefix, COLLECTIONS.notifications.schema),
    activity: R("activity"), attachments: R("attachments"),
  } as unknown as Repositories;
}

const NAMES = Object.keys(COLLECTIONS) as CollectionName[];

export function createPostgresStorageAdmin(db: Db): StorageAdmin {
  const insertAll = async (q: import("./db").Queryable, name: string, rows: unknown[]) => {
    await q.query("DELETE FROM records WHERE collection = $1", [name]);
    let seq = 0;
    for (const row of rows) {
      const r = COLLECTIONS[name as CollectionName].schema.parse(row) as { id: string };
      await q.query("INSERT INTO records (collection, id, seq, data) VALUES ($1, $2, $3, $4::jsonb)", [name, r.id, ++seq, JSON.stringify(r)]);
    }
  };
  return {
    async readAll(name) {
      await db.ready;
      const r = await db.query<{ data: unknown }>("SELECT data FROM records WHERE collection = $1 ORDER BY seq", [name]);
      return r.rows.map((x) => x.data);
    },
    replaceAll: (name, rows) => db.tx(async (q) => {
      await q.query("SELECT pg_advisory_xact_lock(hashtext($1))", [name]);
      await insertAll(q, name, rows);
    }),
    // restore/import: every collection in ONE transaction, so a failure leaves the old data untouched
    replaceMany: (data) => db.tx(async (q) => {
      for (const name of NAMES) await q.query("SELECT pg_advisory_xact_lock(hashtext($1))", [name]);
      for (const name of NAMES) if (name in data) await insertAll(q, name, data[name]);
    }),
  };
}

export function createPostgresBackupStore(db: Db): BackupStore {
  return {
    async save(meta, data) {
      await db.ready;
      let name = backupStamp(), n = 0;
      for (;;) {
        const hit = await db.query("SELECT 1 FROM backups WHERE name = $1", [name]);
        if (!hit.rows.length) break;
        name = `${backupStamp()}-${++n}`;
      }
      const info: BackupInfo = { ...meta, name };
      await db.query("INSERT INTO backups (name, created_at, info, data) VALUES ($1, $2, $3::jsonb, $4::jsonb)", [
        name, info.createdAt, JSON.stringify(info), JSON.stringify(data),
      ]);
      return info;
    },
    async list() {
      await db.ready;
      const r = await db.query<{ info: BackupInfo }>("SELECT info FROM backups ORDER BY created_at DESC");
      return r.rows.map((x) => x.info);
    },
    async load(name) {
      await db.ready;
      const r = await db.query<{ data: Record<string, unknown[]> }>("SELECT data FROM backups WHERE name = $1", [name]);
      return r.rows[0]?.data ?? null;
    },
    async remove(name) {
      await db.ready;
      return (await db.query("DELETE FROM backups WHERE name = $1", [name])).rowCount > 0;
    },
  };
}
