import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createJsonRepositories, createJsonStorageAdmin } from "@/repositories/json";
import { createServices } from "@/services/container";
import { seed } from "@/seed/seed";
import type { Actor } from "@/utils/rbac";

export async function makeEnv(opts: { seed?: boolean } = { seed: true }) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "taskflow-test-"));
  const dataDir = path.join(root, "data");
  process.env.DATA_DIR = dataDir;
  process.env.BACKUP_DIR = path.join(root, "backups");
  const storage = createJsonStorageAdmin(dataDir);
  if (opts.seed !== false) await seed(storage, { force: true });
  const svc = createServices(createJsonRepositories(dataDir), storage);
  return { root, dataDir, storage, svc, cleanup: () => fs.rm(root, { recursive: true, force: true }) };
}

export const actors = {
  admin: { id: "USR-001", name: "Nouman Khatib", role: "ADMIN" } as Actor,
  pm: { id: "USR-002", name: "Ravi Sharma", role: "PROJECT_MANAGER" } as Actor,
  dev: { id: "USR-003", name: "Sharique Ahmed", role: "DEVELOPER" } as Actor,
  designer: { id: "USR-004", name: "Priya Nair", role: "DESIGNER" } as Actor,
  finance: { id: "USR-006", name: "Kavita Rao", role: "FINANCE" } as Actor,
};
