import { COLLECTIONS, type CollectionName } from "@/schemas/entities";
import type { BackupInfo, BackupStore, StorageAdmin } from "@/repositories/interfaces";
import { BACKUP_RETENTION } from "@/utils/config";
import { AppError, invalid, notFound } from "@/utils/errors";
import { logger } from "@/utils/logger";
import { requirePerm, type Actor } from "@/utils/rbac";
import { z } from "zod";
import type { Deps } from "./shared";

export type { BackupInfo };
const NAMES = Object.keys(COLLECTIONS) as CollectionName[];

export const EXPORT_VERSION = 1;
const BundleShape = z.object({
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.string().optional(),
  collections: z.record(z.string(), z.array(z.unknown())),
});

/** Snapshots, export, import and restore. Storage-agnostic: snapshots live in a BackupStore (folder or database). */
export class BackupService {
  constructor(
    private d: Deps,
    private storage: StorageAdmin,
    private store: BackupStore,
  ) {}

  /** Snapshot every collection into the backup store. */
  async create(reason = "manual", userId: string | null = null): Promise<BackupInfo> {
    try {
      const data: Record<string, unknown[]> = {};
      const rows: Record<string, number> = {};
      for (const k of NAMES) {
        data[k] = await this.storage.readAll(k);
        rows[k] = data[k].length;
      }
      const info = await this.store.save(
        { createdAt: new Date().toISOString(), reason, createdBy: userId, rows, totalRows: Object.values(rows).reduce((a, b) => a + b, 0) },
        data,
      );
      await this.prune();
      return info;
    } catch (err) {
      logger.error("Backup failed", err);
      throw new AppError("STORAGE_ERROR", "Unable to create backup. Please try again.");
    }
  }

  list(): Promise<BackupInfo[]> {
    return this.store.list();
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
    const data = await this.store.load(name);
    if (!data) throw notFound("Backup");
    for (const k of NAMES) if (!Array.isArray(data[k])) throw invalid(`Backup is incomplete or damaged (${COLLECTIONS[k].file}).`);
    const rows = this.validateAll(data);
    const safety = await this.create("pre-restore", actor.id);
    await this.storage.replaceMany(rows);
    await this.d.activity.log({
      entityType: "SYSTEM", entityId: name, action: "RESTORED_BACKUP", userId: actor.id,
      message: `${actor.name} restored backup ${name} (safety copy: ${safety.name})`,
    });
    return { restored: name, safetyBackup: safety.name };
  }

  async remove(actor: Actor, name: string) {
    requirePerm(actor, "backup:manage");
    if (!/^[\w.-]+$/.test(name)) throw invalid("Invalid backup name.");
    if (!(await this.store.remove(name))) throw notFound("Backup");
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
    const data: Record<string, unknown[]> = {};
    for (const k of NAMES) data[k] = parsed.data.collections[k] ?? [];
    const rows = this.validateAll(data);
    const users = rows.users as { role: string; active: boolean; isDeleted: boolean }[];
    if (!users.some((u) => u.role === "ADMIN" && u.active && !u.isDeleted)) {
      throw invalid("Import rejected: it would leave the system without an active admin.");
    }
    const safety = await this.create("pre-import", actor.id);
    await this.storage.replaceMany(rows);
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

  private async prune() {
    const all = await this.store.list();
    for (const b of all.slice(BACKUP_RETENTION)) await this.store.remove(b.name).catch(() => undefined);
  }
}
