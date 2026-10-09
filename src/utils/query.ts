export interface PageQuery {
  page: number;
  pageSize: number;
  sort?: string; // "field:asc|desc"
}
export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface Paged<T> {
  data: T[];
  meta: PageMeta;
}

export function parsePageQuery(sp: URLSearchParams, defaults: { pageSize?: number; sort?: string } = {}): PageQuery {
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(sp.get("pageSize") ?? String(defaults.pageSize ?? 25), 10) || 25));
  return { page, pageSize, sort: sp.get("sort") ?? defaults.sort };
}

function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls last
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function sortItems<T>(items: T[], sort?: string, allowed?: string[]): T[] {
  if (!sort) return items;
  const [field, dir = "asc"] = sort.split(":");
  if (allowed && !allowed.includes(field)) return items;
  const m = dir === "desc" ? -1 : 1;
  return [...items].sort((a, b) => m * cmp((a as Record<string, unknown>)[field], (b as Record<string, unknown>)[field]));
}

export function paginate<T>(items: T[], q: PageQuery, allowedSort?: string[]): Paged<T> {
  const sorted = sortItems(items, q.sort, allowedSort);
  const total = sorted.length;
  const start = (q.page - 1) * q.pageSize;
  return {
    data: sorted.slice(start, start + q.pageSize),
    meta: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
  };
}

export const csv = (v: string | null): string[] | undefined =>
  v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

export const matchesText = (q: string | undefined, ...fields: (string | null | undefined)[]) => {
  if (!q) return true;
  const n = q.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(n));
};

export const today = () => new Date().toISOString().slice(0, 10);
