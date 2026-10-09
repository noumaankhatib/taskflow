import { createInfra } from "@/repositories/infra";
import { seed } from "./seed";
import { logger } from "@/utils/logger";
import { paths } from "@/utils/config";
import { databaseUrl } from "@/repositories/postgres/db";

const g = globalThis as unknown as { __seedChecked?: Set<string> };

/** Development convenience: seed demo data on first run. Never auto-seeds in production. */
export async function seedIfNeeded() {
  if (process.env.NODE_ENV === "production" || process.env.AUTO_SEED === "false") return;
  g.__seedChecked ??= new Set();
  if (g.__seedChecked.has(databaseUrl() || paths.data)) return;
  g.__seedChecked.add(databaseUrl() || paths.data);
  if (await seed((await createInfra()).storage)) logger.info("Seeded demo data (first run).");
}
