/** Browser-side API client. The UI only ever talks to /api/*; it never touches JSON files. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface PageMeta { page: number; pageSize: number; total: number; totalPages: number; [k: string]: unknown }
export interface Envelope<T> { data: T; meta?: PageMeta }

async function request<T>(method: string, url: string, body?: unknown): Promise<Envelope<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body instanceof FormData || body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("Cannot reach the server. Check your connection and try again.", 0, "NETWORK");
  }
  if (res.status === 204) return { data: undefined as T };
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login") && url !== "/api/auth/login") {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    throw new ApiError(json?.error?.message ?? "Something went wrong. Please try again.", res.status, json?.error?.code ?? "ERROR", json?.error?.details);
  }
  return json as Envelope<T>;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url).then((r) => r.data),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}).then((r) => r.data),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body ?? {}).then((r) => r.data),
  del: (url: string) => request<void>("DELETE", url).then(() => undefined),
  upload: <T>(url: string, form: FormData) => request<T>("POST", url, form).then((r) => r.data),
  /** Returns data and pagination meta. */
  page: <T>(url: string) => request<T[]>("GET", url),
};

export const messageOf = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");

/** Build a query string, skipping empty values. Arrays become comma lists. */
export function qs(params: Record<string, string | number | boolean | string[] | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) continue;
    sp.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
