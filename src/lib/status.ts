/** One place for status → colour so every screen agrees. */
export type Tone = "slate" | "blue" | "indigo" | "violet" | "amber" | "orange" | "emerald" | "rose" | "sky" | "zinc";

export const toneClasses: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  zinc: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
};
export const dotClasses: Record<Tone, string> = {
  slate: "bg-slate-400", zinc: "bg-zinc-400", blue: "bg-blue-500", sky: "bg-sky-500", indigo: "bg-indigo-500",
  violet: "bg-violet-500", amber: "bg-amber-500", orange: "bg-orange-500", emerald: "bg-emerald-500", rose: "bg-rose-500",
};

export const taskStatusTone: Record<string, Tone> = {
  BACKLOG: "zinc", TODO: "slate", IN_PROGRESS: "blue", BLOCKED: "rose", REVIEW: "violet", COMPLETED: "emerald", CANCELLED: "zinc",
};
export const projectStatusTone: Record<string, Tone> = {
  PLANNING: "sky", ACTIVE: "emerald", ON_HOLD: "amber", COMPLETED: "indigo", CANCELLED: "zinc",
};
export const priorityTone: Record<string, Tone> = { LOW: "slate", MEDIUM: "sky", HIGH: "orange", CRITICAL: "rose" };
export const paymentStatusTone: Record<string, Tone> = {
  PENDING: "amber", PARTIALLY_PAID: "sky", PAID: "emerald", OVERDUE: "rose", CANCELLED: "zinc",
};
export const approvalTone: Record<string, Tone> = { PENDING: "amber", APPROVED: "emerald", REJECTED: "rose" };
export const healthTone: Record<string, Tone> = { ON_TRACK: "emerald", AT_RISK: "amber", DELAYED: "rose", DONE: "indigo" };
export const severityTone: Record<string, Tone> = { INFO: "blue", SUCCESS: "emerald", WARNING: "amber", ERROR: "rose" };

export const HEALTH_LABEL: Record<string, string> = { ON_TRACK: "On track", AT_RISK: "At risk", DELAYED: "Delayed", DONE: "Done" };

export const TASK_BOARD_COLUMNS = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "COMPLETED"] as const;
