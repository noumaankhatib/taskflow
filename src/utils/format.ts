/** Formatting + label helpers shared by server and UI. */
export function formatMoney(value: number, currency = "INR"): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(value || 0);
}
export const formatPct = (v: number) => `${Math.round(v * 10) / 10}%`;
export const round2 = (n: number) => Math.round(n * 100) / 100;

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(iso);
}

export const humanize = (v: string) =>
  v.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin", PROJECT_MANAGER: "Project Manager", DEVELOPER: "Developer", DESIGNER: "Designer",
  QA: "QA", FINANCE: "Finance", VIEWER: "Viewer",
};
export const label = (v: string) => ROLE_LABEL[v] ?? humanize(v);
