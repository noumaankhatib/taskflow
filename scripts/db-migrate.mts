import { getDb, databaseUrl } from "../src/repositories/postgres/db";

if (!databaseUrl()) {
  console.error("DATABASE_URL is not set. Run `vercel env pull .env.local` first (or export DATABASE_URL).");
  process.exit(1);
}
const db = await getDb();
await db.ready; // creates the tables if they don't exist (idempotent)
const r = await db.query<{ collection: string; n: string }>("SELECT collection, count(*) AS n FROM records GROUP BY collection ORDER BY collection");
console.log("Schema ready.", r.rows.length ? r.rows.map((x) => `${x.collection}=${x.n}`).join(" ") : "No data yet.");
await db.close();
