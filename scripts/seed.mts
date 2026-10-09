import { createInfra } from "../src/repositories/infra";
import { DEMO_PASSWORD, seed } from "../src/seed/seed";

const force = process.argv.includes("--force");
const infra = await createInfra();
const done = await seed(infra.storage, { force });
console.log(done ? `Seeded demo data into ${infra.kind}. Sign in as nouman@taskflow.local / ${DEMO_PASSWORD}` : "Data already exists. Use --force to overwrite.");
process.exit(0);
