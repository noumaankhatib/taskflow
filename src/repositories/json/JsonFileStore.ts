import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { ZodType } from "zod";
import { AppError } from "@/utils/errors";
import { logger } from "@/utils/logger";

/**
 * One JSON array file with safe concurrent access.
 *
 *  - every read/write goes through a per-file promise queue (writes are serialized, so two
 *    simultaneous read-modify-write cycles can never overwrite each other)
 *  - writes go to a temp file, are fsynced, validated, then atomically renamed over the target
 *  - the previous good copy is kept as `<file>.bak`; a corrupt main file is recovered from it
 */
export class JsonFileStore<T> {
  private queue: Promise<unknown> = Promise.resolve();
  private cache: T[] | null = null;
  private cacheSig = "";

  constructor(
    readonly filePath: string,
    private readonly rowSchema: ZodType<T>,
  ) {}

  /** Snapshot of all rows (deep copy; callers cannot mutate the cache). */
  read(): Promise<T[]> {
    return this.enqueue(async () => structuredClone(await this.load()));
  }

  /**
   * Atomic read-modify-write. `fn` receives a draft array it may freely mutate; the result is
   * validated and persisted only if `fn` completes without throwing.
   */
  mutate<R>(fn: (draft: T[]) => R | Promise<R>): Promise<R> {
    return this.enqueue(async () => {
      const draft = structuredClone(await this.load());
      const result = await fn(draft);
      await this.persist(draft);
      return result;
    });
  }

  /** Replace the whole file (import / restore). Rows are validated first. */
  replaceAll(rows: unknown[]): Promise<void> {
    return this.enqueue(async () => {
      await this.load().catch(() => undefined); // ignore corruption: we're overwriting
      await this.persist(rows as T[]);
    });
  }

  /** Drop the in-memory cache (after files were changed on disk by restore). */
  invalidate(): Promise<void> {
    return this.enqueue(async () => {
      this.cache = null;
    });
  }

  private enqueue<R>(task: () => Promise<R>): Promise<R> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined); // keep the chain alive after a failure
    return run;
  }

  private async signature(): Promise<string> {
    try {
      const s = await fs.stat(this.filePath);
      return `${s.mtimeMs}:${s.size}`;
    } catch {
      return "missing";
    }
  }

  private async load(): Promise<T[]> {
    const sig = await this.signature();
    if (this.cache && sig === this.cacheSig) return this.cache;

    let rows: T[];
    if (sig === "missing") {
      // a missing main file may be the result of a crash between backup and rename
      rows = (await this.tryParse(this.filePath + ".bak")) ?? [];
    } else {
      const main = await this.tryParse(this.filePath);
      if (main) rows = main;
      else {
        const bak = await this.tryParse(this.filePath + ".bak");
        if (!bak) {
          throw new AppError(
            "STORAGE_ERROR",
            `Data file ${path.basename(this.filePath)} is corrupted and no valid backup copy exists.`,
          );
        }
        logger.error(`Recovered ${path.basename(this.filePath)} from .bak after corruption`);
        await fs.copyFile(this.filePath, `${this.filePath}.corrupt-${Date.now()}`).catch(() => undefined);
        await this.persist(bak, false);
        return this.cache!;
      }
    }
    this.cache = rows;
    this.cacheSig = await this.signature();
    return rows;
  }

  private async tryParse(file: string): Promise<T[] | null> {
    try {
      const raw = await fs.readFile(file, "utf8");
      const json = JSON.parse(raw);
      if (!Array.isArray(json)) return null;
      return json.map((r) => this.rowSchema.parse(r));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.error(`Cannot read ${path.basename(file)}`, err);
      }
      return null;
    }
  }

  private async persist(rows: T[], keepBackup = true): Promise<void> {
    let validated: T[];
    try {
      validated = rows.map((r) => this.rowSchema.parse(r)); // never write invalid data
    } catch (err) {
      throw new AppError("VALIDATION_ERROR", "Refusing to save: data failed validation.", String(err));
    }
    const json = JSON.stringify(validated, null, 2);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
    try {
      const fh = await fs.open(tmp, "w");
      try {
        await fh.writeFile(json, "utf8");
        await fh.sync();
      } finally {
        await fh.close();
      }
      JSON.parse(await fs.readFile(tmp, "utf8")); // verify what hit the disk parses
      if (keepBackup) await fs.copyFile(this.filePath, this.filePath + ".bak").catch(() => undefined);
      await fs.rename(tmp, this.filePath); // atomic on POSIX
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => undefined);
      logger.error(`Failed writing ${path.basename(this.filePath)}`, err);
      throw new AppError("STORAGE_ERROR", "Unable to save changes. Please try again.");
    }
    this.cache = validated;
    this.cacheSig = await this.signature();
  }
}
