"use client";
import type { ProjectFinancials } from "@/modules/projects/finance";
import { formatMoney, formatPct } from "@/utils/format";
import { cn } from "@/components/ui/cn";
import { ProgressBar } from "@/components/ui/display";

function Row({ label, value, strong, tone, muted }: { label: string; value: string; strong?: boolean; tone?: "good" | "bad"; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className={cn("text-sm", muted ? "text-slate-500" : "text-slate-700", strong && "font-semibold text-slate-900")}>{label}</span>
      <span className={cn("tabular-nums text-sm", strong ? "text-base font-semibold" : "font-medium", tone === "good" && "text-emerald-600", tone === "bad" && "text-rose-600", !tone && "text-slate-900")}>{value}</span>
    </div>
  );
}

/** Per-project financial block (spec §31). Everything is computed server-side from payments, time and expenses. */
export function FinancialSummary({ financials: f }: { financials: ProjectFinancials }) {
  const good = f.netProfit >= 0;
  return (
    <div className="text-sm">
      <Row label="Contract Value" value={formatMoney(f.contractValue)} strong />
      <Row label="Received" value={formatMoney(f.received)} />
      <Row label="Pending" value={formatMoney(f.pending)} />
      <hr className="my-2 border-slate-200" />
      <Row label="Team Cost" value={formatMoney(f.teamCost)} />
      <Row label="Other Expenses" value={formatMoney(f.otherExpenses)} />
      <div className="my-1 border-t border-dashed border-slate-300" />
      <Row label="Total Cost" value={formatMoney(f.totalCost)} strong />
      <hr className="my-2 border-slate-200" />
      <Row label="Net Profit" value={formatMoney(f.netProfit)} strong tone={good ? "good" : "bad"} />
      <Row label="Profit Margin" value={formatPct(f.profitMargin)} strong tone={good ? "good" : "bad"} />
      <Row label="Cash Profit (received − cost)" value={formatMoney(f.cashProfit)} muted tone={f.cashProfit >= 0 ? undefined : "bad"} />
      {f.budget > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Budget used</span><span>{formatMoney(f.totalCost)} of {formatMoney(f.budget)} ({formatPct(f.budgetUsedPct)})</span></div>
          <ProgressBar value={f.budgetUsedPct} tone={f.budgetUsedPct > 100 ? "rose" : f.budgetUsedPct > 85 ? "amber" : "indigo"} label="Budget used" />
        </div>
      )}
    </div>
  );
}
