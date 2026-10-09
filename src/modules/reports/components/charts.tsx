"use client";
import { cn } from "@/components/ui/cn";

/** Horizontal bar list: label, bar, value. Pure CSS. */
export function BarList({ rows, format, tone = "bg-indigo-500" }: { rows: { key: string; label: string; value: number; sub?: string }[]; format: (n: number) => string; tone?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-700">{r.label}</span>
            <span className="shrink-0 tabular-nums font-medium text-slate-900">{format(r.value)}{r.sub && <span className="ml-1.5 text-xs font-normal text-slate-400">{r.sub}</span>}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", tone)} style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Simple vertical bar chart (SVG-free, flex based). */
export function ColumnChart({ rows, format }: { rows: { key: string; label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex h-52 items-end gap-2 overflow-x-auto pb-1 pt-6" role="img" aria-label="Monthly expenses chart">
      {rows.map((r) => (
        <div key={r.key} className="flex h-full min-w-10 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] tabular-nums text-slate-500">{format(r.value)}</span>
          <div className="w-full max-w-12 rounded-t bg-indigo-500" style={{ height: `${Math.max(2, (r.value / max) * 100)}%` }} />
          <span className="text-[11px] text-slate-500">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Stacked horizontal segment bar with legend. */
export function SegmentBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">{parts.map((p) => p.value > 0 && <div key={p.label} className={p.color} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.value}`} />)}</div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">{parts.map((p) => <li key={p.label} className="flex items-center gap-1.5"><span className={cn("size-2 rounded-full", p.color)} />{p.label} <span className="tabular-nums text-slate-400">{p.value}</span></li>)}</ul>
    </div>
  );
}
