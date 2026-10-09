"use client";
import { useState } from "react";
import { Card, CardHeader, ProgressBar, StatCard, StatusBadge } from "@/components/ui/display";
import { Select } from "@/components/ui/form";
import { EmptyState, ErrorState, CardsSkeleton } from "@/components/ui/feedback";
import { TableWrap, THead, Th, Td, Tr } from "@/components/ui/table";
import { useApi } from "@/lib/hooks";
import { useLookup } from "@/lib/lookups";
import { projectStatusTone } from "@/lib/status";
import { formatMoney, formatPct, label } from "@/utils/format";
import type { ProjectFinancials } from "@/modules/projects/finance";
import { BarList, SegmentBar } from "./charts";

interface Report {
  project: { id: string; name: string; status: string; clientId: string };
  financials: ProjectFinancials | null;
  tasks: { total: number; completed: number; completionPct: number; overdue: number; byStatus: Record<string, number> };
  hoursByMember: { userId: string; name: string; hours: number; cost: number }[];
  expensesByCategory: { category: string; amount: number }[];
}

export function ProjectReport() {
  const { projects, clientName } = useLookup();
  const list = projects.filter((p) => !p.isDeleted);
  const [id, setId] = useState("");
  const selected = id || list[0]?.id || "";
  const { data, error, isLoading, reload } = useApi<Report>(selected ? `/api/reports/project/${selected}` : null);
  const f = data?.financials;

  return (
    <div className="space-y-4">
      <div className="max-w-sm"><Select label="Project" value={selected} onChange={(e) => setId(e.target.value)}>{list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></div>
      {!selected ? <Card><EmptyState title="No projects" description="Create a project to see its report." /></Card>
        : isLoading && !data ? <CardsSkeleton count={4} />
        : error && !data ? <Card><ErrorState error={error} onRetry={reload} /></Card>
        : data && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500"><StatusBadge value={data.project.status} tones={projectStatusTone} /> {clientName(data.project.clientId)}</div>
            {f && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Revenue (contract)" value={formatMoney(f.contractValue)} hint={`Received ${formatMoney(f.received)}`} />
                <StatCard label="Team cost" value={formatMoney(f.teamCost)} />
                <StatCard label="Expenses" value={formatMoney(f.otherExpenses)} hint={f.expenseBreakdown.pendingApproval ? `${formatMoney(f.expenseBreakdown.pendingApproval)} pending approval` : undefined} />
                <StatCard label="Net profit" value={formatMoney(f.netProfit)} tone={f.netProfit >= 0 ? "good" : "bad"} hint={`Margin ${formatPct(f.profitMargin)}`} />
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Hours" description="Estimated vs actual" />
                {f ? (<>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div><p className="text-xl font-semibold tabular-nums">{f.hours.estimated}h</p><p className="text-xs text-slate-500">Estimated</p></div>
                    <div><p className="text-xl font-semibold tabular-nums">{f.hours.actual}h</p><p className="text-xs text-slate-500">Actual</p></div>
                    <div><p className="text-xl font-semibold tabular-nums">{f.hours.remaining}h</p><p className="text-xs text-slate-500">Remaining</p></div>
                  </div>
                  <ProgressBar className="mt-4" value={f.hours.estimated ? (f.hours.actual / f.hours.estimated) * 100 : 0} tone={f.hours.actual > f.hours.estimated ? "rose" : "indigo"} label="Hours used" />
                  <p className="mt-1 text-xs text-slate-400">{f.hours.billable}h billable</p>
                </>) : <p className="text-sm text-slate-500">Hour totals are available to finance roles.</p>}
              </Card>
              <Card>
                <CardHeader title="Task completion" description={`${data.tasks.completed} of ${data.tasks.total} tasks done`} />
                <div className="mb-4 flex items-center gap-3"><span className="text-2xl font-semibold tabular-nums">{data.tasks.completionPct}%</span><ProgressBar className="flex-1" value={data.tasks.completionPct} tone="emerald" label="Task completion" /></div>
                <SegmentBar parts={[
                  { label: "Backlog/Todo", value: data.tasks.byStatus.BACKLOG + data.tasks.byStatus.TODO, color: "bg-slate-300" },
                  { label: "In progress", value: data.tasks.byStatus.IN_PROGRESS, color: "bg-blue-500" },
                  { label: "Blocked", value: data.tasks.byStatus.BLOCKED, color: "bg-rose-500" },
                  { label: "Review", value: data.tasks.byStatus.REVIEW, color: "bg-violet-500" },
                  { label: "Done", value: data.tasks.byStatus.COMPLETED, color: "bg-emerald-500" },
                ]} />
                {data.tasks.overdue > 0 && <p className="mt-3 text-xs font-medium text-rose-600">{data.tasks.overdue} overdue</p>}
              </Card>
              <Card padded={false}>
                <div className="p-4 sm:p-5 pb-0"><CardHeader title="Hours by team member" /></div>
                {data.hoursByMember.length ? (
                  <TableWrap><THead><tr><Th>Member</Th><Th className="text-right">Hours</Th><Th className="text-right">Cost</Th></tr></THead>
                    <tbody>{data.hoursByMember.map((m) => <Tr key={m.userId}><Td className="font-medium">{m.name}</Td><Td className="text-right tabular-nums">{m.hours}</Td><Td className="text-right tabular-nums">{formatMoney(m.cost)}</Td></Tr>)}</tbody></TableWrap>
                ) : <EmptyState title="No time logged" />}
              </Card>
              <Card>
                <CardHeader title="Expenses by category" />
                {data.expensesByCategory.length ? <BarList rows={data.expensesByCategory.map((c) => ({ key: c.category, label: label(c.category), value: c.amount }))} format={(n) => formatMoney(n)} /> : <EmptyState title="No approved expenses" />}
              </Card>
            </div>
          </>
        )}
    </div>
  );
}
