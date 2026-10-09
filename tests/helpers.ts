import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { jsonInfra, postgresInfra } from "@/repositories/infra";
import { createPgDb, createPgliteDb } from "@/repositories/postgres/db";
import { createDiskFileStorage } from "@/repositories/json/DiskFileStorage";
import { createServices } from "@/services/container";
import { seed } from "@/seed/seed";
import type { Actor } from "@/utils/rbac";

export type Backend = "json" | "postgres" | "pg-server";
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

/** Fresh, isolated environment on the chosen backend (temp dir for JSON, in-process Postgres for "postgres"). */
export async function makeEnv(opts: { seed?: boolean; backend?: Backend } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "taskflow-test-"));
  const dataDir = path.join(root, "data");
  process.env.DATA_DIR = dataDir;
  process.env.BACKUP_DIR = path.join(root, "backups");
  let infra;
  let closeDb = async () => {};
  if (opts.backend === "pg-server") {
    // the production `pg` driver against a real server (set TEST_DATABASE_URL); tables are wiped per test
    const db = await createPgDb(TEST_DATABASE_URL);
    await db.ready;
    await db.query("TRUNCATE records, backups");
    infra = postgresInfra(db, createDiskFileStorage());
    closeDb = () => db.close();
  } else if (opts.backend === "postgres") {
    const db = await createPgliteDb();
    infra = postgresInfra(db, createDiskFileStorage());
    closeDb = () => db.close();
  } else infra = jsonInfra(dataDir);
  if (opts.seed !== false) await seed(infra.storage, { force: true });
  const svc = createServices(infra);
  return { root, dataDir, storage: infra.storage, svc, cleanup: async () => { await closeDb(); await fs.rm(root, { recursive: true, force: true }); } };
}

export const actors = {
  admin: { id: "USR-001", name: "Nouman Khatib", role: "ADMIN" } as Actor,
  pm: { id: "USR-002", name: "Ravi Sharma", role: "PROJECT_MANAGER" } as Actor,
  dev: { id: "USR-003", name: "Sharique Ahmed", role: "DEVELOPER" } as Actor,
  designer: { id: "USR-004", name: "Priya Nair", role: "DESIGNER" } as Actor,
  finance: { id: "USR-006", name: "Kavita Rao", role: "FINANCE" } as Actor,
};
