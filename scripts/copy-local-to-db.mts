// One-off: copy the local JSON data (./data/*.json) into the PostgreSQL database in DATABASE_URL.
// Refuses to overwrite a database that already has users unless --force is given.
import { createJsonStorageAdmin } from "../src/repositories/json";
import { createInfra } from "../src/repositories/infra";
import { COLLECTIONS, type CollectionName } from "../src/schemas/entities";

const force = process.argv.includes("--force");
const target = await createInfra();
if (target.kind !== "postgres") { console.error("DATABASE_URL is not set."); process.exit(1); }
if (!force && (await target.storage.readAll("users")).length) { console.error("Database already has users. Use --force to overwrite."); process.exit(1); }
const local = createJsonStorageAdmin();
const data: Record<string, unknown[]> = {};
for (const k of Object.keys(COLLECTIONS) as CollectionName[]) data[k] = await local.readAll(k);
await target.storage.replaceMany(data);
console.log("Copied:", Object.entries(data).map(([k, v]) => `${k}=${v.length}`).join(" "));
process.exit(0);
