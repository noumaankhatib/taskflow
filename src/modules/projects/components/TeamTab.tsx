"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, UserMinus, UsersRound } from "lucide-react";
import type { TimeEntry } from "@/schemas/entities";
import type { TaskView } from "@/modules/tasks/task.service";
import { Button } from "@/components/ui/Button";
import { Avatar, Badge, Card, CardHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { useConfirm } from "@/components/ui/overlay";
import { UserSelect } from "@/components/ui/pickers";
import { useToast } from "@/components/ui/toast";
import { TableWrap, THead, Td, Th, Tr } from "@/components/ui/table";
import { api } from "@/lib/api";
import { invalidate, useApi } from "@/lib/hooks";
import { useCan, useLookup } from "@/lib/lookups";
import { label, round2 } from "@/utils/format";
import type { ProjectView } from "./types";

export function TeamTab({ project, onChanged }: { project: ProjectView; onChanged: () => Promise<void> }) {
  const { usersById, users } = useLookup();
  const canWrite = useCan("project:write");
  const toast = useToast();
  const confirm = useConfirm();
  const [adding, setAdding] = useState<string | null>(null);
  const time = useApi<TimeEntry[]>(`/api/time-entries?projectId=${project.id}`);
  const tasks = useApi<TaskView[]>(`/api/tasks?projectId=${project.id}&pageSize=500`);

  const memberIds = [...new Set([...project.memberIds, ...(project.projectManagerId ? [project.projectManagerId] : [])])];
  const rows = memberIds.map((id) => {
    const u = usersById.get(id);
    const hours = (time.data ?? []).filter((t) => t.userId === id).reduce((s, t) => s + t.hours, 0);
    const open = (tasks.data ?? []).filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED" && (t.primaryOwnerId === id || t.contributorIds.includes(id))).length;
    return { id, u, hours: round2(hours), open };
  });

  async function save(ids: string[], msg: string) {
    try { await api.put(`/api/projects/${project.id}`, { memberIds: ids }); toast.success(msg); await invalidate("/api/projects", "/api/tasks"); await onChanged(); } catch (e) { toast.error(e); }
  }
  async function remove(id: string) {
    const name = usersById.get(id)?.name ?? id;
    const hasWork = rows.find((r) => r.id === id)?.open;
    if (!(await confirm({ title: `Remove ${name}?`, message: hasWork ? `${name} still has ${hasWork} open task(s) in this project. Reassign them afterwards.` : "They will no longer be able to be assigned to this project's tasks.", confirmLabel: "Remove", destructive: true }))) return;
    await save(project.memberIds.filter((m) => m !== id), `${name} removed from the project`);
  }
  async function add() {
    if (!adding) return;
    await save([...project.memberIds, adding], `${usersById.get(adding)?.name ?? "Member"} added`);
    setAdding(null);
  }
  const available = users.filter((u) => u.active && !memberIds.includes(u.id));

  return (
    <Card padded={false}>
      <div className="p-4 pb-0 sm:p-5 sm:pb-0"><CardHeader title="Project team" description={`${memberIds.length} members`} /></div>
      {canWrite && !project.isDeleted && (
        <div className="flex items-end gap-2 px-4 pb-4 sm:px-5">
          <div className="w-full max-w-xs"><UserSelect label="Add a member" value={adding} onChange={setAdding} people={available} placeholder="Choose person…" /></div>
          <Button variant="outline" icon={<Plus className="size-4" />} disabled={!adding} onClick={add}>Add</Button>
        </div>
      )}
      {time.isLoading && !time.data ? <TableSkeleton rows={4} cols={4} /> : time.error ? <ErrorState error={time.error} onRetry={time.reload} /> : !rows.length ? (
        <EmptyState icon={<UsersRound className="size-5" />} title="No team members yet" description="Add people so they can be assigned tasks in this project." />
      ) : (
        <TableWrap>
          <THead><tr><Th>Member</Th><Th>Role</Th><Th className="text-right">Hours logged</Th><Th className="text-right">Open tasks</Th><Th className="w-10"><span className="sr-only">Actions</span></Th></tr></THead>
          <tbody>
            {rows.map(({ id, u, hours, open }) => (
              <Tr key={id}>
                <Td><div className="flex items-center gap-2.5"><Avatar name={u?.name ?? id} src={u?.avatar} size={30} /><div><Link href={`/team?user=${id}`} className="font-medium text-slate-900 hover:text-indigo-600">{u?.name ?? id}</Link><div className="text-xs text-slate-500">{u?.email}</div></div></div></Td>
                <Td>{u ? label(u.role) : "—"}{id === project.projectManagerId && <Badge tone="indigo" className="ml-2">Manager</Badge>}</Td>
                <Td className="text-right tabular-nums">{hours}h</Td>
                <Td className="text-right tabular-nums">{open}</Td>
                <Td>{canWrite && !project.isDeleted && id !== project.projectManagerId && <Button variant="ghost" size="xs" aria-label={`Remove ${u?.name ?? id}`} onClick={() => remove(id)}><UserMinus className="size-4" /></Button>}</Td>
              </Tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </Card>
  );
}
