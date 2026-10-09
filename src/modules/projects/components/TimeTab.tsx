"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import type { TimeEntry } from "@/schemas/entities";
import type { TaskView } from "@/modules/tasks/task.service";
import { Badge, Card, StatCard } from "@/components/ui/display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/form";
import { TableWrap, THead, Td, Th, Tr } from "@/components/ui/table";
import { qs } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useLookup } from "@/lib/lookups";
import { formatDate, round2 } from "@/utils/format";
import type { ProjectView } from "./types";

export function TimeTab({ project }: { project: ProjectView }) {
  const { userName } = useLookup();
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [group, setGroup] = useState<"none" | "member">("none");
  const { data, error, isLoading, reload } = useApi<TimeEntry[]>(`/api/time-entries${qs({ projectId: project.id, userId, from, to })}`);
  const tasks = useApi<TaskView[]>(`/api/tasks?projectId=${project.id}&pageSize=500`);
  const title = (id: string) => tasks.data?.find((t) => t.id === id)?.title ?? id;
  const all = useApi<TimeEntry[]>(`/api/time-entries?projectId=${project.id}`);
  const memberIds = [...new Set((all.data ?? []).map((t) => t.userId))];

  const totals = useMemo(() => {
    const rows = data ?? [];
    const sum = (f: (t: TimeEntry) => boolean) => round2(rows.filter(f).reduce((s, t) => s + t.hours, 0));
    return { total: sum(() => true), billable: sum((t) => t.billable), non: sum((t) => !t.billable) };
  }, [data]);
  const byMember = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of data ?? []) m.set(t.userId, (m.get(t.userId) ?? 0) + t.hours);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total hours" value={`${totals.total}h`} />
        <StatCard label="Billable" value={`${totals.billable}h`} tone="good" />
        <StatCard label="Non-billable" value={`${totals.non}h`} />
      </div>
      <Card padded={false}>
        <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-3 sm:grid-cols-4">
          <Select aria-label="Member" value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">All members</option>{memberIds.map((id) => <option key={id} value={id}>{userName(id)}</option>)}</Select>
          <Input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Select aria-label="View" value={group} onChange={(e) => setGroup(e.target.value as "none" | "member")}><option value="none">All entries</option><option value="member">Summary by member</option></Select>
        </div>
        {isLoading && !data ? <TableSkeleton cols={5} /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? (
          <EmptyState icon={<Clock className="size-5" />} title="No time logged" description={userId || from || to ? "No entries match these filters." : "Time logged against this project's tasks will appear here."} />
        ) : group === "member" ? (
          <TableWrap>
            <THead><tr><Th>Member</Th><Th className="text-right">Hours</Th><Th className="text-right">Share</Th></tr></THead>
            <tbody>{byMember.map(([id, h]) => <Tr key={id}><Td className="font-medium text-slate-900">{userName(id)}</Td><Td className="text-right tabular-nums">{round2(h)}h</Td><Td className="text-right tabular-nums">{Math.round((h / (totals.total || 1)) * 100)}%</Td></Tr>)}</tbody>
          </TableWrap>
        ) : (
          <TableWrap>
            <THead><tr><Th>Date</Th><Th>Member</Th><Th>Task</Th><Th>Description</Th><Th className="text-right">Hours</Th><Th>Type</Th></tr></THead>
            <tbody>
              {data.map((t) => (
                <Tr key={t.id}>
                  <Td className="whitespace-nowrap">{formatDate(t.date)}</Td>
                  <Td>{userName(t.userId)}</Td>
                  <Td className="max-w-[16rem]"><Link href={`/tasks?task=${t.taskId}`} className="block truncate hover:text-indigo-600" title={title(t.taskId)}><span className="font-mono text-xs text-slate-400">{t.taskId}</span> {title(t.taskId)}</Link></Td>
                  <Td className="max-w-[14rem] truncate text-slate-500">{t.description || "—"}</Td>
                  <Td className="text-right tabular-nums">{t.hours}h</Td>
                  <Td>{t.billable ? <Badge tone="emerald">Billable</Badge> : <Badge tone="zinc">Non-billable</Badge>}</Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
