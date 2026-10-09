import path from "node:path";

/** Locations are overridable via env so tests can run against temp directories. */
export const paths = {
  get data() {
    return path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
  },
  get backups() {
    return path.resolve(process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups"));
  },
  get uploads() {
    return path.join(this.data, "uploads");
  },
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const BACKUP_RETENTION = 30;
