import type { ZodType } from "zod";
import type { BaseEntity } from "@/schemas/common";
import type { NewEntity, Repository } from "../interfaces/Repository";
import { AppError, notFound } from "@/utils/errors";
import type { Db, Queryable } from "./db";

const numericSuffix = (id: string) => Number(id.slice(id.lastIndexOf("-") + 1));

/**
 * Generic Postgres repository. Each entity is a validated JSON document in `records`, keyed by (collection, id).
 * Writes run in a transaction guarded by a per-collection advisory lock, so concurrent creates get unique ids
 * and read-modify-write updates can never interleave (the same guarantee the JSON write queue gives).
 */
export class PgRepository<T extends BaseEntity> implements Repository<T> {
  constructor(
    protected readonly db: Db,
    protected readonly collection: string,
    protected readonly prefix: string,
    protected readonly schema: ZodType<T>,
  ) {}

  protected parse(row: unknown): T {
    try {
      return this.schema.parse(row);
    } catch (err) {
      throw new AppError("VALIDATION_ERROR", "Refusing to save: data failed validation.", String(err));
    }
  }

  protected async lock(q: Queryable) {
    await q.query("SELECT pg_advisory_xact_lock(hashtext($1))", [this.collection]);
  }

  protected async nextSeq(q: Queryable) {
    const r = await q.query<{ m: number | null }>("SELECT max(seq) AS m FROM records WHERE collection = $1", [this.collection]);
    return (r.rows[0]?.m ?? 0) + 1;
  }

  protected async insert(q: Queryable, row: T, seq: number) {
    await q.query("INSERT INTO records (collection, id, seq, data) VALUES ($1, $2, $3, $4::jsonb)", [
      this.collection, row.id, seq, JSON.stringify(row),
    ]);
  }

  async findAll() {
    await this.db.ready;
    const r = await this.db.query<{ data: unknown }>("SELECT data FROM records WHERE collection = $1 ORDER BY seq", [this.collection]);
    return r.rows.map((x) => this.schema.parse(x.data));
  }

  async find(where: Partial<T>) {
    await this.db.ready;
    const r = await this.db.query<{ data: unknown }>(
      "SELECT data FROM records WHERE collection = $1 AND data @> $2::jsonb ORDER BY seq",
      [this.collection, JSON.stringify(where)],
    );
    return r.rows.map((x) => this.schema.parse(x.data));
  }

  async findById(id: string) {
    await this.db.ready;
    const r = await this.db.query<{ data: unknown }>("SELECT data FROM records WHERE collection = $1 AND id = $2", [this.collection, id]);
    return r.rows[0] ? this.schema.parse(r.rows[0].data) : null;
  }

  async create(data: NewEntity<T>) {
    return (await this.createMany([data]))[0];
  }

  createMany(items: NewEntity<T>[]) {
    return this.db.tx(async (q) => {
      await this.lock(q);
      let seq = await this.nextSeq(q);
      const now = new Date().toISOString();
      const out: T[] = [];
      for (const item of items) {
        const id = `${this.prefix}-${String(seq).padStart(3, "0")}`;
        const row = this.parse({ ...item, id, createdAt: now, updatedAt: now });
        await this.insert(q, row, seq++);
        out.push(row);
      }
      return out;
    });
  }

  update(id: string, patch: Partial<Omit<T, "id" | "createdAt">>) {
    return this.db.tx(async (q) => {
      await this.lock(q);
      const cur = await q.query<{ data: unknown }>("SELECT data FROM records WHERE collection = $1 AND id = $2 FOR UPDATE", [this.collection, id]);
      if (!cur.rows[0]) throw notFound();
      const next = this.parse({ ...(cur.rows[0].data as object), ...patch, id, updatedAt: new Date().toISOString() });
      await q.query("UPDATE records SET data = $3::jsonb WHERE collection = $1 AND id = $2", [this.collection, id, JSON.stringify(next)]);
      return next;
    });
  }

  async delete(id: string) {
    await this.db.ready;
    const r = await this.db.query("DELETE FROM records WHERE collection = $1 AND id = $2", [this.collection, id]);
    return r.rowCount > 0;
  }

  async deleteWhere(where: Partial<T>) {
    await this.db.ready;
    const r = await this.db.query("DELETE FROM records WHERE collection = $1 AND data @> $2::jsonb", [this.collection, JSON.stringify(where)]);
    return r.rowCount;
  }
}

export { numericSuffix };
