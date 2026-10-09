import type { BaseEntity } from "@/schemas/common";
import type { NewEntity, Repository } from "../interfaces/Repository";
import { notFound } from "@/utils/errors";
import type { JsonFileStore } from "./JsonFileStore";

function nextIdFrom(rows: { id: string }[], prefix: string): string {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const r of rows) {
    const m = re.exec(r.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

/** Generic JSON-backed repository. Concrete classes only bind the store + id prefix. */
export class JsonRepository<T extends BaseEntity> implements Repository<T> {
  constructor(
    protected readonly store: JsonFileStore<T>,
    protected readonly prefix: string,
  ) {}

  findAll() {
    return this.store.read();
  }

  async find(where: Partial<T>) {
    const entries = Object.entries(where);
    return (await this.store.read()).filter((r) =>
      entries.every(([k, v]) => (r as Record<string, unknown>)[k] === v),
    );
  }

  async findById(id: string) {
    return (await this.store.read()).find((r) => r.id === id) ?? null;
  }

  async create(data: NewEntity<T>) {
    return (await this.createMany([data]))[0];
  }

  createMany(items: NewEntity<T>[]) {
    return this.store.mutate((rows) => {
      const now = new Date().toISOString();
      const out: T[] = [];
      for (const data of items) {
        // id is derived inside the write lock, so concurrent creates never collide
        const row = { ...data, id: nextIdFrom(rows, this.prefix), createdAt: now, updatedAt: now } as unknown as T;
        rows.push(row);
        out.push(row);
      }
      return out;
    });
  }

  update(id: string, patch: Partial<Omit<T, "id" | "createdAt">>) {
    return this.store.mutate((rows) => {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) throw notFound();
      const next = { ...rows[idx], ...patch, id, updatedAt: new Date().toISOString() } as T;
      rows[idx] = next;
      return next;
    });
  }

  delete(id: string) {
    return this.store.mutate((rows) => {
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) return false;
      rows.splice(idx, 1);
      return true;
    });
  }

  deleteWhere(where: Partial<T>) {
    const entries = Object.entries(where);
    return this.store.mutate((rows) => {
      let n = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (entries.every(([k, v]) => (rows[i] as Record<string, unknown>)[k] === v)) {
          rows.splice(i, 1);
          n++;
        }
      }
      return n;
    });
  }
}
