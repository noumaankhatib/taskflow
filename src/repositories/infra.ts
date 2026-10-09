import type { Repositories, StorageAdmin } from "./interfaces";
import type { BackupStore, FileStorage } from "./interfaces/infra";
import { createJsonRepositories, createJsonStorageAdmin } from "./json";
import { createFileBackupStore } from "./json/FileBackupStore";
import { createDiskFileStorage } from "./json/DiskFileStorage";
import { createPostgresBackupStore, createPostgresRepositories, createPostgresStorageAdmin } from "./postgres";
import { createBlobFileStorage } from "./blob/BlobFileStorage";
import { getDb, usingPostgres, type Db } from "./postgres/db";

export interface Infra {
  kind: "json" | "postgres";
  repos: Repositories;
  storage: StorageAdmin;
  backupStore: BackupStore;
  files: FileStorage;
}

export const postgresInfra = (db: Db, files: FileStorage): Infra => ({
  kind: "postgres",
  repos: createPostgresRepositories(db),
  storage: createPostgresStorageAdmin(db),
  backupStore: createPostgresBackupStore(db),
  files,
});

export function jsonInfra(dataDir?: string): Infra {
  return {
    kind: "json",
    repos: createJsonRepositories(dataDir),
    storage: createJsonStorageAdmin(dataDir),
    backupStore: createFileBackupStore(),
    files: createDiskFileStorage(),
  };
}

/** Picks the backend from the environment: DATABASE_URL set → Postgres (+ Vercel Blob), otherwise local JSON files. */
export async function createInfra(): Promise<Infra> {
  if (!usingPostgres()) return jsonInfra();
  const files = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID ? createBlobFileStorage() : createDiskFileStorage();
  return postgresInfra(await getDb(), files);
}
