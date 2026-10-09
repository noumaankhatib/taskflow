import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { COLLECTIONS, type CollectionName } from "@/schemas/entities";
import type { StorageAdmin } from "@/repositories/interfaces";
import { BACKUP_RETENTION, paths } from "@/utils/config";
import { AppError, invalid, notFound } from "@/utils/errors";
import { logger } from "@/utils/logger";
import { requirePerm, type Actor } from "@/utils/rbac";
import type { Deps } from "./shared";

const NAMES = Object.keys(COLLECTIONS) as CollectionName[];

export interface BackupInfo { name: string; createdAt: string; reason: string; createdBy: string | null; rows: Record<string, number>; totalRows: number }

const stamp = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

export const EXPORT_VERSION = 1;
const BundleShape = z.object({
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.string().optional(),
  collections: z.record(z.string(), z.array(z.unknown())),
});

/** Timestamped snapshots under /backups plus validated export / import / restore. */
export class BackupService {
  constructor(
    private d: Deps,
    private storage: StorageAdmin,
  ) {}

  /** Snapshot every collection (each read goes through its write queue, so files are internally consistent). */
  async create(reason = "manual", userId: string | null = null): Promise<BackupInfo> {
    await fs.mkdir(paths.backups, { recursive: true });
    let name = stamp(), n = 0;
    while (await exists(path.join(paths.backups, name))) name = `${stamp()}-${++n}`;
    const dir = path.join(paths.backups, name);
    const tmp = `${dir}.partial`;
    await fs.mkdir(tmp, { recursive: true });
    const rows: Record<string, number> = {};
    try {
      for (const k of NAMES) {
        const data = await this.storage.readAll(k);
        rows[k] = data.length;
        await fs.writeFile(path.join(tmp, COLLECTIONS[k].file), JSON.stringify(data, null, 2), "utf8");
      }
      const info: BackupInfo = {
        name, createdAt: new Date().toISOString(), reason, createdBy: userId, rows,
        totalRows: Object.values(rows).reduce((a, b) => a + b, 0),
      };
      await fs.writeFile(path.join(tmp, "manifest.json"), JSON.stringify(info, null, 2), "utf8");
      await fs.rename(tmp, dir); // a backup directory only appears once it is complete
      await this.prune();
      return info;
    } catch (err) {
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
      logger.error("Backup failed", err);
      throw new AppError("STORAGE_ERROR", "Unable to create backup. Please try again.");
    }
  }

  async list(): Promise<BackupInfo[]> {
    const entries = await fs.readdir(paths.backups, { withFileTypes: true }).catch(() => []);
    const out: BackupInfo[] = [];
    for (const e of entries) {
      if (!e.isDirectory() || e.name.endsWith(".partial")) continue;
      try {
        out.push(JSON.parse(await fs.readFile(path.join(paths.backups, e.name, "manifest.json"), "utf8")));
      } catch {
        /* skip dirs without a valid manifest */
      }
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async backupNow(actor: Actor) {
    requirePerm(actor, "backup:manage");
    const info = await this.create("manual", actor.id);
    await this.d.activity.log({ entityType: "SYSTEM", entityId: info.name, action: "BACKUP", userId: actor.id, message: `${actor.name} created backup ${info.name}` });
    return info;
  }

  async restore(actor: Actor, name: string) {
    requirePerm(actor, "backup:manage");
    if (!/^[\w.-]+$/.test(name)) throw invalid("Invalid backup name.");
    const dir = path.join(paths.backups, name);
    if (!(await exists(dir))) throw notFound("Backup");
    const data: Record<string, unknown[]> = {};
    for (const k of NAMES) {
      try {
        data[k] = JSON.parse(await fs.readFile(path.join(dir, COLLECTIONS[k].file), "utf8"));
      } catch {
        throw invalid(`Backup is incomplete or damaged (${COLLECTIONS[k].file}).`);
      }
    }
    const rows = this.validateAll(data);
    const safety = await this.create("pre-restore", actor.id);
    await this.apply(rows);
    await this.d.activity.log({
      entityType: "SYSTEM", entityId: name, action: "RESTORED_BACKUP", userId: actor.id,
      message: `${actor.name} restored backup ${name} (safety copy: ${safety.name})`,
    });
    return { restored: name, safetyBackup: safety.name };
  }

  async remove(actor: Actor, name: string) {
    requirePerm(actor, "backup:manage");
    if (!/^[\w.-]+$/.test(name)) throw invalid("Invalid backup name.");
    const dir = path.join(paths.backups, name);
    if (!(await exists(dir))) throw notFound("Backup");
    await fs.rm(dir, { recursive: true, force: true });
  }

  async export(actor: Actor) {
    requirePerm(actor, "backup:manage");
    const collections: Record<string, unknown[]> = {};
    for (const k of NAMES) collections[k] = await this.storage.readAll(k);
    return { version: EXPORT_VERSION, exportedAt: new Date().toISOString(), collections };
  }

  /** Validate the whole bundle first; nothing is replaced unless every row is valid. */
  async import(actor: Actor, bundle: unknown) {
    requirePerm(actor, "backup:manage");
    const parsed = BundleShape.safeParse(bundle);
    if (!parsed.success) throw invalid("This file is not a valid export (expected version and collections).");
    const incoming = parsed.data.collections;
    const data: Record<string, unknown[]> = {};
    for (const k of NAMES) data[k] = incoming[k] ?? [];
    const rows = this.validateAll(data);
    const users = rows.users as { role: string; active: boolean; isDeleted: boolean }[];
    if (!users.some((u) => u.role === "ADMIN" && u.active && !u.isDeleted)) {
      throw invalid("Import rejected: it would leave the system without an active admin.");
    }
    const safety = await this.create("pre-import", actor.id);
    await this.apply(rows);
    return { imported: Object.fromEntries(NAMES.map((k) => [k, rows[k].length])), safetyBackup: safety.name };
  }

  private validateAll(data: Record<string, unknown[]>): Record<CollectionName, unknown[]> {
    const out = {} as Record<CollectionName, unknown[]>;
    for (const k of NAMES) {
      const list = data[k];
      if (!Array.isArray(list)) throw invalid(`"${k}" must be an array.`);
      const ids = new Set<string>();
      out[k] = list.map((row, i) => {
        const r = COLLECTIONS[k].schema.safeParse(row);
        if (!r.success) throw invalid(`Invalid data in ${COLLECTIONS[k].file} (row ${i + 1}): ${r.error.issues[0]?.message ?? "invalid"}`);
        if (ids.has(r.data.id)) throw invalid(`Duplicate id ${r.data.id} in ${COLLECTIONS[k].file}.`);
        ids.add(r.data.id);
        return r.data;
      });
    }
    return out;
  }

  private async apply(rows: Record<CollectionName, unknown[]>) {
    for (const k of NAMES) await this.storage.replaceAll(k, rows[k]);
  }

  private async prune() {
    const all = await this.list();
    for (const b of all.slice(BACKUP_RETENTION)) await fs.rm(path.join(paths.backups, b.name), { recursive: true, force: true }).catch(() => undefined);
  }
}

async function exists(p: string) {
  return fs.access(p).then(() => true, () => false);
}
