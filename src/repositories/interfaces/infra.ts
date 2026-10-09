/** Storage-related ports that are not entity repositories. Implemented once for local disk/JSON and once for Postgres/Blob. */

export interface BackupInfo {
  name: string;
  createdAt: string;
  reason: string;
  createdBy: string | null;
  rows: Record<string, number>;
  totalRows: number;
}

/** Bulk operations used by backup/restore/import. */
export interface StorageAdmin {
  readAll(name: string): Promise<unknown[]>;
  replaceAll(name: string, rows: unknown[]): Promise<void>;
  /** Replace several collections together (one transaction where the backend supports it). */
  replaceMany(data: Record<string, unknown[]>): Promise<void>;
}

/** Where full-data snapshots live (a /backups folder, or a database table). */
export interface BackupStore {
  /** Persists a snapshot; the store assigns the (timestamp) name. */
  save(meta: Omit<BackupInfo, "name">, data: Record<string, unknown[]>): Promise<BackupInfo>;
  list(): Promise<BackupInfo[]>;
  /** null when the backup does not exist. */
  load(name: string): Promise<Record<string, unknown[]> | null>;
  remove(name: string): Promise<boolean>;
}

/** Binary storage for uploaded files (local disk, or Vercel Blob). */
export interface FileStorage {
  /** Stores the bytes and returns an opaque key to persist on the attachment. */
  put(name: string, data: Buffer, contentType: string): Promise<string>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

export const backupStamp = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
