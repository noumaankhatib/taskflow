import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JsonFileStore } from "@/repositories/json/JsonFileStore";
import { makeEnv } from "./helpers";

const Row = z.object({ id: z.string(), n: z.number() });
let env: Awaited<ReturnType<typeof makeEnv>>;
beforeAll(async () => { env = await makeEnv({ seed: false }); });
afterAll(() => env.cleanup());

describe("JsonFileStore", () => {
  it("serializes concurrent read-modify-write cycles without losing updates", async () => {
    const store = new JsonFileStore(path.join(env.dataDir, "counter.json"), Row);
    await store.mutate((rows) => void rows.push({ id: "c", n: 0 }));
    await Promise.all(Array.from({ length: 100 }, () => store.mutate((rows) => { rows[0].n += 1; })));
    expect((await store.read())[0].n).toBe(100);
    expect(JSON.parse(await fs.readFile(store.filePath, "utf8"))[0].n).toBe(100);
  });

  it("does not write when the mutation throws or produces invalid data", async () => {
    const store = new JsonFileStore(path.join(env.dataDir, "guard.json"), Row);
    await store.mutate((rows) => void rows.push({ id: "a", n: 1 }));
    await expect(store.mutate(() => { throw new Error("boom"); })).rejects.toThrow("boom");
    await expect(store.mutate((rows) => void rows.push({ id: "b", n: "x" as never }))).rejects.toThrow();
    expect(await store.read()).toEqual([{ id: "a", n: 1 }]);
    // queue is still healthy afterwards
    await store.mutate((rows) => void rows.push({ id: "c", n: 3 }));
    expect((await store.read()).length).toBe(2);
  });

  it("leaves no temp files behind and keeps a .bak of the previous version", async () => {
    const store = new JsonFileStore(path.join(env.dataDir, "tmp.json"), Row);
    await store.mutate((rows) => void rows.push({ id: "a", n: 1 }));
    await store.mutate((rows) => void rows.push({ id: "b", n: 2 }));
    const files = await fs.readdir(env.dataDir);
    expect(files.filter((f) => f.startsWith("tmp.json") && f.endsWith(".tmp"))).toEqual([]);
    expect(JSON.parse(await fs.readFile(store.filePath + ".bak", "utf8")).length).toBe(1);
  });

  it("recovers from a corrupted main file using the .bak copy", async () => {
    const file = path.join(env.dataDir, "corrupt.json");
    const store = new JsonFileStore(file, Row);
    await store.mutate((rows) => void rows.push({ id: "a", n: 1 }));
    await store.mutate((rows) => void rows.push({ id: "b", n: 2 })); // .bak now holds [a]
    await fs.writeFile(file, "{ this is not json", "utf8");
    const fresh = new JsonFileStore(file, Row); // simulates a restart (no cache)
    const rows = await fresh.read();
    expect(rows.map((r) => r.id)).toEqual(["a"]);
    expect(JSON.parse(await fs.readFile(file, "utf8")).length).toBe(1); // main file repaired
  });

  it("reports a storage error when both main file and backup are corrupt", async () => {
    const file = path.join(env.dataDir, "dead.json");
    await fs.writeFile(file, "garbage");
    await fs.writeFile(file + ".bak", "also garbage");
    await expect(new JsonFileStore(file, Row).read()).rejects.toMatchObject({ code: "STORAGE_ERROR" });
  });

  it("assigns unique sequential ids under concurrent creates", async () => {
    const { svc } = env;
    await env.storage.replaceAll("clients", []);
    const created = await Promise.all(
      Array.from({ length: 40 }, (_, i) => svc.repos.clients.create({ companyName: `C${i}`, contactPerson: "", email: "", phone: "", address: "", notes: "", active: true })),
    );
    const ids = new Set(created.map((c) => c.id));
    expect(ids.size).toBe(40);
    expect((await svc.repos.clients.findAll()).length).toBe(40);
  });
});
