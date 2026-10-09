import fs from "node:fs/promises";
import path from "node:path";
import { COLLECTIONS, type CollectionName } from "@/schemas/entities";
import { backupStamp, type BackupInfo, type BackupStore } from "../interfaces/infra";
import { paths } from "@/utils/config";

const exists = (p: string) => fs.access(p).then(() => true, () => false);
const NAMES = Object.keys(COLLECTIONS) as CollectionName[];

/** Snapshots as `backups/<yyyy-mm-dd-hhmmss>/` folders. A folder only appears once complete (written to `.partial` then renamed). */
export function createFileBackupStore(dir = () => paths.backups): BackupStore {
  return {
    async save(meta, data) {
      const root = dir();
      await fs.mkdir(root, { recursive: true });
      let name = backupStamp(), n = 0;
      while (await exists(path.join(root, name))) name = `${backupStamp()}-${++n}`;
      const final = path.join(root, name), tmp = `${final}.partial`;
      await fs.mkdir(tmp, { recursive: true });
      try {
        for (const k of NAMES) await fs.writeFile(path.join(tmp, COLLECTIONS[k].file), JSON.stringify(data[k] ?? [], null, 2), "utf8");
        const info: BackupInfo = { ...meta, name };
        await fs.writeFile(path.join(tmp, "manifest.json"), JSON.stringify(info, null, 2), "utf8");
        await fs.rename(tmp, final);
        return info;
      } catch (err) {
        await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
        throw err;
      }
    },
    async list() {
      const entries = await fs.readdir(dir(), { withFileTypes: true }).catch(() => []);
      const out: BackupInfo[] = [];
      for (const e of entries) {
        if (!e.isDirectory() || e.name.endsWith(".partial")) continue;
        try {
          out.push(JSON.parse(await fs.readFile(path.join(dir(), e.name, "manifest.json"), "utf8")));
        } catch { /* skip folders without a valid manifest */ }
      }
      return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async load(name) {
      const root = path.join(dir(), name);
      if (!(await exists(root))) return null;
      const data: Record<string, unknown[]> = {};
      for (const k of NAMES) {
        try {
          data[k] = JSON.parse(await fs.readFile(path.join(root, COLLECTIONS[k].file), "utf8"));
        } catch {
          data[k] = undefined as never; // reported by the service as an incomplete backup
        }
      }
      return data;
    },
    async remove(name) {
      const root = path.join(dir(), name);
      if (!(await exists(root))) return false;
      await fs.rm(root, { recursive: true, force: true });
      return true;
    },
  };
}
