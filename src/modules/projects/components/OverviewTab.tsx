"use client";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ListChecks } from "lucide-react";
import { Avatar, Card, CardHeader, KeyValue, ProgressBar, StatCard } from "@/components/ui/display";
import { useApi } from "@/lib/hooks";
import { useLookup } from "@/lib/lookups";
import { formatDate, formatPct, round2 } from "@/utils/format";
import { ProjectOpenIssues } from "@/modules/tasks/components/OpenIssues";
import { FinancialSummary } from "./FinancialSummary";
import type { ProjectView } from "./types";

export function OverviewTab({ project: p }: { project: ProjectView }) {
  const { userName, usersById, clientName } = useLookup();
  const f = p.financials;
  const open = p.taskStats.total - p.taskStats.done;
  const hours = f?.hours;
  // hours are only returned with financials; fall back to nothing for non-finance roles
  const tasksByStatus = useApi<{ status: string }[]>(`/api/tasks?projectId=${p.id}&pageSize=500`);
  const counts = (s: string) => tasksByStatus.data?.filter((t) => t.status === s).length ?? 0;
  const pm = p.projectManagerId;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <CardHeader title="About" />
          <p className="whitespace-pre-wrap text-sm text-slate-700">{p.description || <span className="text-slate-400">No description added.</span>}</p>
          <div className="mt-5"><KeyValue items={[
            { label: "Client", value: <Link href={`/clients?client=${p.clientId}`} className="hover:text-indigo-600">{clientName(p.clientId)}</Link> },
            { label: "Project manager", value: pm ? <span className="inline-flex items-center gap-2"><Avatar name={userName(pm)} src={usersById.get(pm)?.avatar} size={20} />{userName(pm)}</span> : "—" },
            { label: "Start date", value: formatDate(p.startDate) },
            { label: "Expected end", value: formatDate(p.expectedEndDate) },
            { label: "Actual end", value: formatDate(p.actualEndDate) },
            { label: "Created", value: formatDate(p.createdAt) },
          ]} /></div>
        </Card>

        <ProjectOpenIssues projectId={p.id} />

        <Card>
          <CardHeader title="Progress" description={`${p.taskStats.done} of ${p.taskStats.total} tasks completed`} />
          <div className="flex items-center gap-3"><ProgressBar value={p.progress} tone={p.progress === 100 ? "emerald" : "indigo"} className="flex-1" label="Project progress" /><span className="text-sm font-semibold tabular-nums">{p.progress}%</span></div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Open tasks" value={open} icon={<ListChecks className="size-4" />} />
            <StatCard label="In progress" value={counts("IN_PROGRESS")} />
            <StatCard label="In review" value={counts("REVIEW")} />
            <StatCard label="Overdue" value={p.taskStats.overdue} tone={p.taskStats.overdue ? "bad" : undefined} icon={p.taskStats.overdue ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />} />
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        {f ? (
          <>
            <Card><CardHeader title="Financial summary" description="Calculated live from payments, time and expenses" /><FinancialSummary financials={f} /></Card>
            {hours && (
              <Card>
                <CardHeader title="Hours" />
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[["Estimated", hours.estimated], ["Actual", hours.actual], ["Remaining", hours.remaining]].map(([l, v]) => (
                    <div key={l as string} className="rounded-lg bg-slate-50 p-2.5"><div className="text-lg font-semibold tabular-nums">{round2(v as number)}h</div><div className="text-xs text-slate-500">{l}</div></div>
                  ))}
                </div>
                {hours.estimated > 0 && <p className="mt-3 text-xs text-slate-500">{formatPct((hours.actual / hours.estimated) * 100)} of estimate used · {hours.billable}h billable</p>}
              </Card>
            )}
          </>
        ) : (
          <Card><CardHeader title="Financials" /><p className="text-sm text-slate-500">Financial details are visible to project managers, finance and admins.</p></Card>
        )}
      </div>
    </div>
  );
}
