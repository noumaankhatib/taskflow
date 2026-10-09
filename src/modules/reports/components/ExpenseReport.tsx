"use client";
import { useState } from "react";
import { Card, CardHeader, StatCard } from "@/components/ui/display";
import { Input, Select } from "@/components/ui/form";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/ui/feedback";
import { useApi } from "@/lib/hooks";
import { qs } from "@/lib/api";
import { useLookup } from "@/lib/lookups";
import { formatMoney, label } from "@/utils/format";
import { BarList, ColumnChart } from "./charts";

interface Group { key: string; amount: number; pct: number; name?: string }
interface Report { total: number; count: number; byProject: Group[]; byCategory: Group[]; byMember: Group[]; monthly: Group[] }

const monthLabel = (k: string) => new Date(k + "-01T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

export function ExpenseReport() {
  const { projects } = useLookup();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [projectId, setProjectId] = useState("");
  const { data, error, isLoading, reload } = useApi<Report>(`/api/reports/expenses${qs({ from, to, projectId })}`);
  const rows = (g: Group[], name = (x: Group) => x.name ?? x.key) => g.map((x) => ({ key: x.key, label: name(x), value: x.amount, sub: `${x.pct}%` }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)} wrapperClassName="min-w-48"><option value="">All projects</option>{projects.filter((p) => !p.isDeleted).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Input label="From" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
      </div>
      {isLoading && !data ? <CardsSkeleton count={4} /> : error && !data ? <Card><ErrorState error={error} onRetry={reload} /></Card> : data && (
        !data.count ? <Card><EmptyState title="No approved expenses" description="Try a different date range or project." /></Card> : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Total (approved)" value={formatMoney(data.total)} /><StatCard label="Expenses" value={data.count} /><StatCard label="Top category" value={label(data.byCategory[0]?.key ?? "—")} hint={data.byCategory[0] && formatMoney(data.byCategory[0].amount)} /><StatCard label="Top spender" value={data.byMember[0]?.name ?? "—"} hint={data.byMember[0] && formatMoney(data.byMember[0].amount)} /></div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card><CardHeader title="By project" /><BarList rows={rows(data.byProject)} format={(n) => formatMoney(n)} /></Card>
              <Card><CardHeader title="By category" /><BarList rows={rows(data.byCategory, (x) => label(x.key))} format={(n) => formatMoney(n)} tone="bg-violet-500" /></Card>
              <Card><CardHeader title="By team member" /><BarList rows={rows(data.byMember)} format={(n) => formatMoney(n)} tone="bg-emerald-500" /></Card>
              <Card><CardHeader title="Monthly expenses" /><ColumnChart rows={data.monthly.map((m) => ({ key: m.key, label: monthLabel(m.key), value: m.amount }))} format={(n) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))} /></Card>
            </div>
          </>
        )
      )}
    </div>
  );
}
