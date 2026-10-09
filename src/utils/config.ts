import path from "node:path";

/** Locations are overridable via env so tests can run against temp directories. */
export const paths = {
  get data() {
    return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? path.join(process.cwd(), "data"));
  },
  get backups() {
    return path.resolve(/*turbopackIgnore: true*/ process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups"));
  },
  get uploads() {
    return path.join(this.data, "uploads");
  },
};

// Vercel serverless functions reject request bodies above 4.5 MB, so keep uploads safely below that everywhere.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const BACKUP_RETENTION = 30;
