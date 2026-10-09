"use client";
import Link from "next/link";
import { Drawer } from "@/components/ui/overlay";
import { Avatar, Badge, KeyValue, StatusBadge } from "@/components/ui/display";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/feedback";
import { useApi } from "@/lib/hooks";
import { useCan, useLookup, useMe } from "@/lib/lookups";
import { priorityTone, projectStatusTone, taskStatusTone } from "@/lib/status";
import { formatDate, formatMoney, label } from "@/utils/format";
import type { PublicUser } from "@/schemas/entities";
import type { TaskView } from "@/modules/tasks/task.service";

const since30 = () => new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

export function UserDrawer({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const me = useMe();
  const canRates = useCan("rates:view");
  const { projectName } = useLookup();
  const user = useApi<PublicUser>(userId ? `/api/users/${userId}` : null);
  const tasks = useApi<TaskView[]>(userId ? `/api/tasks?assigneeId=${userId}&pageSize=200` : null);
  const time = useApi<{ id: string; hours: number }[]>(userId ? `/api/time-entries?userId=${userId}&from=${since30()}` : null);
  const projects = useApi<{ id: string; name: string; status: string; progress: number }[]>(userId ? `/api/projects?memberId=${userId}&pageSize=100` : null);
  const u = user.data;
  const open = (tasks.data ?? []).filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED");
  const hours = (time.data ?? []).reduce((s, e) => s + e.hours, 0);

  return (
    <Drawer open={!!userId} onClose={onClose} width="max-w-xl" subtitle={u ? label(u.role) : undefined}
      title={u ? <span className="flex items-center gap-2"><Avatar name={u.name} src={u.avatar} size={28} />{u.name}</span> : "Team member"}>
      {user.error ? <ErrorState error={user.error} onRetry={user.reload} /> : !u ? (
        <div className="space-y-3 p-5"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-24 w-full" /></div>
      ) : (
        <div className="space-y-6 p-4 sm:p-5">
          <section>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge tone={u.isDeleted ? "rose" : u.active ? "emerald" : "zinc"} dot>{u.isDeleted ? "Removed" : u.active ? "Active" : "Inactive"}</Badge>
              <Badge tone="indigo">{label(u.role)}</Badge>
            </div>
            <KeyValue items={[
              { label: "Email", value: <a className="text-indigo-600 hover:underline" href={`mailto:${u.email}`}>{u.email}</a> },
              { label: "Member since", value: formatDate(u.createdAt) },
              ...((canRates || me.id === u.id) ? [{ label: "Hourly rate", value: formatMoney(u.hourlyRate) }, { label: "Daily rate", value: formatMoney(u.dailyRate) }] : []),
              { label: "Hours logged (30 days)", value: time.isLoading ? "…" : `${Math.round(hours * 10) / 10} h` },
            ]} />
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Open tasks ({open.length})</h3>
            {tasks.isLoading ? <Skeleton className="h-16 w-full" /> : !open.length ? <EmptyState title="No open tasks" className="py-6" /> : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {open.slice(0, 12).map((t) => (
                  <li key={t.id}><Link href={`/tasks?task=${t.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{t.title}</span><span className="block truncate text-xs text-slate-500">{projectName(t.projectId)} · due {formatDate(t.dueDate)}</span></span>
                    {t.isOverdue && <Badge tone="rose">Overdue</Badge>}
                    <StatusBadge value={t.priority} tones={priorityTone} className="hidden sm:inline-flex" />
                    <StatusBadge value={t.status} tones={taskStatusTone} />
                  </Link></li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Projects ({projects.data?.length ?? 0})</h3>
            {projects.isLoading ? <Skeleton className="h-16 w-full" /> : !projects.data?.length ? <EmptyState title="Not on any project" className="py-6" /> : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {projects.data.map((p) => (
                  <li key={p.id}><Link href={`/projects/${p.id}`} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-50">
                    <span className="truncate text-sm font-medium text-slate-800">{p.name}</span><StatusBadge value={p.status} tones={projectStatusTone} />
                  </Link></li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}
