"use client";
import { useState } from "react";
import { Bug } from "lucide-react";
import { Avatar, Card, CardHeader } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { cn } from "@/components/ui/cn";
import { useApi } from "@/lib/hooks";
import { useLookup } from "@/lib/lookups";
import { formatDate, label } from "@/utils/format";
import { PriorityBadge, TypeBadge, issueRowClass, type TaskView } from "./shared";
import { StatusBadge } from "@/components/ui/display";
import { taskStatusTone } from "@/lib/status";
import { TaskDrawer } from "./TaskDrawer";

const OPEN = "BACKLOG,TODO,IN_PROGRESS,BLOCKED,REVIEW";
const RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
export const sortIssues = (a: TaskView, b: TaskView) =>
  Number(b.isUrgentIssue) - Number(a.isUrgentIssue) || RANK[a.priority] - RANK[b.priority] || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");

/** One open bug/issue: type, title, who it is assigned to, and why it is highlighted. */
export function IssueRow({ t, onOpen, showProject }: { t: TaskView; onOpen: (id: string) => void; showProject?: boolean }) {
  const { usersById, projectName } = useLookup();
  const owner = t.primaryOwnerId ? usersById.get(t.primaryOwnerId) : undefined;
  return (
    <li>
      <button onClick={() => onOpen(t.id)} className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-slate-50", issueRowClass(t))}>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-800"><TypeBadge value={t.type} always /><span className="truncate">{t.title}</span></p>
          <p className="truncate text-xs text-slate-500">
            {t.id}{showProject && ` · ${projectName(t.projectId)}`}
            {t.dueDate && <span className={cn(t.isOverdue && "font-medium text-rose-600")}> · {t.isOverdue ? "Overdue " : "Due "}{formatDate(t.dueDate)}</span>}
          </p>
        </div>
        {t.status === "BLOCKED" ? <StatusBadge value={t.status} tones={taskStatusTone} /> : <span className="hidden text-xs text-slate-500 sm:block">{label(t.status)}</span>}
        <PriorityBadge value={t.priority} />
        <span className="flex w-28 shrink-0 items-center gap-1.5 text-xs">
          {owner ? <><Avatar name={owner.name} src={owner.avatar} size={20} /><span className="truncate text-slate-700">{owner.name}</span></> : <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">Unassigned</span>}
        </span>
      </button>
    </li>
  );
}

/** Open bugs & issues of one project, urgent first. */
export function ProjectOpenIssues({ projectId }: { projectId: string }) {
  const { data } = useApi<TaskView[]>(`/api/tasks?projectId=${projectId}&type=BUG,ISSUE&status=${OPEN}&pageSize=500`);
  const [taskId, setTaskId] = useState<string | null>(null);
  const issues = [...(data ?? [])].sort(sortIssues);
  const urgent = issues.filter((t) => t.isUrgentIssue).length;
  return (
    <Card>
      <CardHeader title="Open issues" description={issues.length ? `${issues.length} open${urgent ? ` · ${urgent} need attention` : ""}` : undefined} />
      {issues.length ? <ul className="-mx-3 space-y-0.5">{issues.map((t) => <IssueRow key={t.id} t={t} onOpen={setTaskId} />)}</ul>
        : <EmptyState icon={<Bug className="size-5" />} title="No open issues" description="Bugs and issues logged on this project show up here." />}
      <TaskDrawer taskId={taskId} onClose={() => setTaskId(null)} />
    </Card>
  );
}
