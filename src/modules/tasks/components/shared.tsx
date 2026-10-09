"use client";
import { Bug, CalendarDays, CircleAlert } from "lucide-react";
import type { TaskView } from "@/modules/tasks/task.service";
import { Badge, StatusBadge } from "@/components/ui/display";
import { Menu } from "@/components/ui/menu";
import { cn } from "@/components/ui/cn";
import { priorityTone, taskStatusTone, taskTypeTone } from "@/lib/status";
import { api } from "@/lib/api";
import { invalidate } from "@/lib/hooks";
import { PRIORITIES } from "@/schemas/common";
import { TASK_STATUSES, TASK_TYPES } from "@/schemas/entities";
import { can as roleCan } from "@/utils/rbac";
import { formatDate, label } from "@/utils/format";
import type { PublicUser } from "@/schemas/entities";
import type { ProjectLite } from "@/lib/lookups";

export type { TaskView };

export const invalidateTasks = () =>
  invalidate("/api/tasks", "/api/dashboard", "/api/projects", "/api/time-entries", "/api/activity", "/api/team");

export const updateTask = async (id: string, patch: Record<string, unknown>) => {
  const t = await api.put<TaskView>(`/api/tasks/${id}`, patch);
  await invalidateTasks();
  return t;
};

/** Client-side mirror of the server rule (server remains the authority). */
export function canEditTask(me: PublicUser, t: Pick<TaskView, "createdBy" | "primaryOwnerId" | "contributorIds">) {
  if (roleCan(me.role, "task:manage")) return true;
  if (!roleCan(me.role, "task:write")) return false;
  return t.createdBy === me.id || t.primaryOwnerId === me.id || t.contributorIds.includes(me.id);
}

/** Project members (+ manager) as pickable people. */
export function projectPeople(project: ProjectLite | undefined, users: PublicUser[]) {
  if (!project) return [];
  const ids = new Set([...project.memberIds, project.projectManagerId].filter(Boolean) as string[]);
  return users.filter((u) => ids.has(u.id) && u.active);
}

export const PriorityBadge = ({ value }: { value: string }) => <StatusBadge value={value} tones={priorityTone} />;

/** Bug / Issue badge; plain tasks show nothing unless `always` is set. */
export function TypeBadge({ value, always }: { value: string; always?: boolean }) {
  if (value === "TASK" && !always) return null;
  const Icon = value === "BUG" ? Bug : CircleAlert;
  return <Badge tone={taskTypeTone[value] ?? "slate"}>{value !== "TASK" && <Icon className="size-3" />}{label(value)}</Badge>;
}

/** Row highlight for open bugs/issues that are overdue, blocked or critical. */
export const issueRowClass = (t: Pick<TaskView, "isUrgentIssue" | "type" | "status">) =>
  t.isUrgentIssue ? "bg-rose-50/60 border-l-2 border-l-rose-500" : t.type !== "TASK" && t.status !== "COMPLETED" && t.status !== "CANCELLED" ? "border-l-2 border-l-amber-400" : "";

export function TypeMenu({ value, onChange, disabled }: { value: string; onChange: (s: string) => void; disabled?: boolean }) {
  if (disabled) return <TypeBadge value={value} always />;
  return (
    <Menu align="left" label="Change type" trigger={<span className="cursor-pointer"><TypeBadge value={value} always /></span>}
      items={TASK_TYPES.map((s) => ({ label: label(s) + (s === value ? " ✓" : ""), onSelect: () => s !== value && onChange(s) }))} />
  );
}

export function DueDate({ task, className }: { task: Pick<TaskView, "dueDate" | "isOverdue">; className?: string }) {
  if (!task.dueDate) return <span className={cn("text-xs text-slate-400", className)}>No due date</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", task.isOverdue ? "font-medium text-rose-600" : "text-slate-500", className)}>
      <CalendarDays className="size-3.5" />
      {formatDate(task.dueDate)}
      {task.isOverdue && " · overdue"}
    </span>
  );
}

export function StatusMenu({ value, onChange, disabled }: { value: string; onChange: (s: string) => void; disabled?: boolean }) {
  if (disabled) return <StatusBadge value={value} tones={taskStatusTone} />;
  return (
    <Menu align="left" label="Change status"
      trigger={<StatusBadge value={value} tones={taskStatusTone} className="cursor-pointer hover:brightness-95" />}
      items={TASK_STATUSES.map((s) => ({ label: label(s) + (s === value ? " ✓" : ""), onSelect: () => s !== value && onChange(s) }))} />
  );
}

export function PriorityMenu({ value, onChange, disabled }: { value: string; onChange: (s: string) => void; disabled?: boolean }) {
  if (disabled) return <PriorityBadge value={value} />;
  return (
    <Menu align="left" label="Change priority" trigger={<span className="cursor-pointer"><PriorityBadge value={value} /></span>}
      items={PRIORITIES.map((s) => ({ label: label(s) + (s === value ? " ✓" : ""), onSelect: () => s !== value && onChange(s) }))} />
  );
}
