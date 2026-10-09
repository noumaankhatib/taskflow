import type { Pool as PgPool } from "pg";

export interface QueryResult<R> { rows: R[]; rowCount: number }
export interface Queryable {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<R>>;
}
/** Minimal SQL client so the repositories don't care whether it is `pg` (Neon/Vercel) or in-process PGlite (tests). */
export interface Db extends Queryable {
  /** Resolves once the schema exists. */
  ready: Promise<void>;
  tx<R>(fn: (q: Queryable) => Promise<R>): Promise<R>;
  close(): Promise<void>;
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS records (
  collection text NOT NULL,
  id         text NOT NULL,
  seq        integer NOT NULL,
  data       jsonb NOT NULL,
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS records_collection_seq ON records (collection, seq);
CREATE INDEX IF NOT EXISTS records_data_gin ON records USING gin (data jsonb_path_ops);
CREATE TABLE IF NOT EXISTS backups (
  name       text PRIMARY KEY,
  created_at timestamptz NOT NULL,
  info       jsonb NOT NULL,
  data       jsonb NOT NULL
);
`;

export const databaseUrl = () => process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL ?? "";
export const usingPostgres = () => !!databaseUrl();

/** Production client: node-postgres pool (works with Neon / Vercel Postgres connection strings). */
export async function createPgDb(connectionString = databaseUrl()): Promise<Db> {
  const { Pool } = await import("pg");
  const pool: PgPool = new Pool({
    connectionString,
    // serverless: keep the pool tiny, one connection per function instance is plenty
    max: Number(process.env.DB_POOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 20_000, // Neon may be waking from suspend
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
  });
  const wrap = (q: { query: PgPool["query"] }): Queryable => ({
    async query(sql, params) {
      const r = await q.query(sql, params as unknown[]);
      return { rows: r.rows as never, rowCount: r.rowCount ?? 0 };
    },
  });
  const base = wrap(pool);
  // Retried after a failure: a transient connect/auth timeout must not poison this instance for its whole lifetime.
  let readyPromise: Promise<void> | undefined;
  const db: Db = {
    ...base,
    get ready() {
      return (readyPromise ??= pool.query(SCHEMA_SQL).then(
        () => undefined,
        (e) => { readyPromise = undefined; throw e; },
      ));
    },
    async tx(fn) {
      await db.ready;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn(wrap(client as never));
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
  db.ready.catch(() => undefined); // surfaced (and retried) on next use
  return db;
}

/** In-process Postgres (WASM). Used by the test-suite so Postgres code paths run without a server. */
export async function createPgliteDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  const wrap = (q: { query: import("@electric-sql/pglite").PGlite["query"] }): Queryable => ({
    async query(sql, params) {
      const r = await q.query(sql, params as unknown[]);
      return { rows: r.rows as never, rowCount: r.affectedRows || r.rows.length };
    },
  });
  const ready = pg.exec(SCHEMA_SQL).then(() => undefined);
  return {
    ...wrap(pg),
    ready,
    async tx(fn) {
      await ready;
      return pg.transaction((t) => fn(wrap(t as never)));
    },
    close: () => pg.close(),
  };
}

const g = globalThis as unknown as { __pgDb?: Promise<Db> };
/** Process-wide shared pool (kept on globalThis so dev hot-reload doesn't leak connections). */
export function getDb(): Promise<Db> {
  return (g.__pgDb ??= createPgDb());
}
