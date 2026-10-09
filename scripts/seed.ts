import { createJsonStorageAdmin } from "../src/repositories/json";
import { DEMO_PASSWORD, seed } from "../src/seed/seed";

const force = process.argv.includes("--force");
seed(createJsonStorageAdmin(), { force }).then((done) => {
  console.log(done ? `Seeded demo data. Sign in as nouman@taskflow.local / ${DEMO_PASSWORD}` : "Data already exists. Use --force to overwrite.");
});
