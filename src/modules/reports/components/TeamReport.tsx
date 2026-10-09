"use client";
import { useState } from "react";
import { Avatar, Card, CardHeader } from "@/components/ui/display";
import { Input } from "@/components/ui/form";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { TableWrap, THead, Th, Td, Tr } from "@/components/ui/table";
import { useApi } from "@/lib/hooks";
import { qs } from "@/lib/api";
import { formatMoney, label } from "@/utils/format";
import { useCan } from "@/lib/lookups";
import { BarList } from "./charts";

interface Row {
  userId: string; name: string; role: string; tasksCompleted: number; hoursWorked: number; billableHours: number; activeTasks: number; overdueTasks: number; cost: number;
  projectAllocation: { projectId: string; name: string; hours: number; pct: number }[];
}

export function TeamReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const showCost = useCan("rates:view");
  const { data, error, isLoading, reload } = useApi<Row[]>(`/api/reports/team${qs({ from, to })}`);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3"><Input label="From" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /><Input label="To" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></div>
      <Card padded={false}>
        {isLoading && !data ? <TableSkeleton cols={6} /> : error && !data ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? <EmptyState title="No team members" /> : (
          <TableWrap>
            <THead><tr><Th>Member</Th><Th className="text-right">Completed</Th><Th className="text-right">Hours</Th><Th className="text-right">Billable</Th><Th className="text-right">Active</Th><Th className="text-right">Overdue</Th>{showCost && <Th className="text-right">Cost</Th>}</tr></THead>
            <tbody>{data.map((r) => (
              <Tr key={r.userId}>
                <Td><span className="flex items-center gap-2"><Avatar name={r.name} size={26} /><span><span className="block font-medium text-slate-900">{r.name}</span><span className="text-xs text-slate-500">{label(r.role)}</span></span></span></Td>
                <Td className="text-right tabular-nums">{r.tasksCompleted}</Td><Td className="text-right tabular-nums">{r.hoursWorked}</Td><Td className="text-right tabular-nums">{r.billableHours}</Td>
                <Td className="text-right tabular-nums">{r.activeTasks}</Td><Td className={`text-right tabular-nums ${r.overdueTasks ? "font-medium text-rose-600" : ""}`}>{r.overdueTasks}</Td>
                {showCost && <Td className="text-right tabular-nums">{formatMoney(r.cost)}</Td>}
              </Tr>))}</tbody>
          </TableWrap>
        )}
      </Card>
      {data && data.some((r) => r.projectAllocation.length) && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Project allocation (hours)</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.filter((r) => r.projectAllocation.length).map((r) => (
              <Card key={r.userId}><CardHeader title={r.name} description={`${r.hoursWorked}h total`} />
                <BarList rows={r.projectAllocation.map((a) => ({ key: a.projectId, label: a.name, value: a.hours, sub: `${a.pct}%` }))} format={(n) => `${n}h`} /></Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
