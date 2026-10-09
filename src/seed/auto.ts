import { createJsonStorageAdmin } from "@/repositories/json";
import { seed } from "./seed";
import { logger } from "@/utils/logger";
import { paths } from "@/utils/config";

const g = globalThis as unknown as { __seedChecked?: Set<string> };

/** Development convenience: seed demo data on first run. Never auto-seeds in production. */
export async function seedIfNeeded() {
  if (process.env.NODE_ENV === "production" || process.env.AUTO_SEED === "false") return;
  g.__seedChecked ??= new Set();
  if (g.__seedChecked.has(paths.data)) return;
  g.__seedChecked.add(paths.data);
  if (await seed(createJsonStorageAdmin())) logger.info("Seeded demo data (first run).");
}
