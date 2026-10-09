"use client";
import { RotateCcw } from "lucide-react";
import { Avatar, AvatarStack, Card } from "@/components/ui/display";
import { Button } from "@/components/ui/Button";
import { Pagination, SortTh, TableWrap, Td, THead, Th, Tr } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import { useCan, useLookup, useMe } from "@/lib/lookups";
import { DueDate, PriorityMenu, StatusMenu, TypeBadge, canEditTask, issueRowClass, updateTask, type TaskView } from "./shared";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { invalidateTasks } from "./shared";

interface Props {
  tasks: TaskView[]; onOpen: (id: string) => void; sort: string; onSort: (s: string) => void;
  page: number; totalPages: number; total: number; pageSize: number; onPage: (p: number) => void; deletedMode?: boolean;
}

export function TaskList({ tasks, onOpen, sort, onSort, page, totalPages, total, pageSize, onPage, deletedMode }: Props) {
  const me = useMe();
  const toast = useToast();
  const manage = useCan("task:manage");
  const { projectName, usersById } = useLookup();
  const change = async (id: string, patch: Record<string, unknown>) => { try { await updateTask(id, patch); } catch (e) { toast.error(e); } };
  const restore = async (id: string) => { try { await api.post(`/api/tasks/${id}/restore`); await invalidateTasks(); toast.success("Task restored"); } catch (e) { toast.error(e); } };
  const people = (t: TaskView) => [t.primaryOwnerId, ...t.contributorIds].filter(Boolean).map((id) => ({ id: id!, name: usersById.get(id!)?.name ?? id!, avatar: usersById.get(id!)?.avatar }));
  const open = (id: string) => !deletedMode && onOpen(id);

  return (
    <Card padded={false}>
      {/* desktop table */}
      <div className="hidden md:block">
        <TableWrap>
          <THead><tr>
            <SortTh label="Task" field="title" sort={sort} onSort={onSort} />
            <SortTh label="Status" field="status" sort={sort} onSort={onSort} />
            <SortTh label="Priority" field="priority" sort={sort} onSort={onSort} />
            <Th>Owner / team</Th>
            <SortTh label="Due" field="dueDate" sort={sort} onSort={onSort} />
            <SortTh label="Hours" field="actualHours" sort={sort} onSort={onSort} className="text-right" />
            {deletedMode && <Th />}
          </tr></THead>
          <tbody>
            {tasks.map((t) => {
              const ed = canEditTask(me, t) && !deletedMode;
              return (
                <Tr key={t.id} onClick={deletedMode ? undefined : () => open(t.id)} className={cn(t.isOverdue && "bg-rose-50/40", issueRowClass(t))}>
                  <Td className="max-w-md"><div className="flex items-center gap-2"><TypeBadge value={t.type} /><span className="truncate font-medium text-slate-900">{t.title}</span></div><div className="truncate text-xs text-slate-400">{t.id} · {projectName(t.projectId)}</div>
                    {t.subtaskTotal > 0 && <div className="text-xs text-slate-400">{t.subtaskDone}/{t.subtaskTotal} subtasks</div>}</Td>
                  <Td onClick={(e) => e.stopPropagation()}><StatusMenu value={t.status} disabled={!ed} onChange={(s) => change(t.id, { status: s })} /></Td>
                  <Td onClick={(e) => e.stopPropagation()}><PriorityMenu value={t.priority} disabled={!ed} onChange={(s) => change(t.id, { priority: s })} /></Td>
                  <Td>{people(t).length ? <AvatarStack people={people(t)} /> : <span className="text-xs text-slate-400">Unassigned</span>}</Td>
                  <Td><DueDate task={t} /></Td>
                  <Td className="text-right tabular-nums text-slate-600">{t.actualHours}/{t.estimatedHours}h</Td>
                  {deletedMode && <Td>{manage && <Button size="xs" variant="outline" icon={<RotateCcw className="size-3" />} onClick={() => restore(t.id)}>Restore</Button>}</Td>}
                </Tr>
              );
            })}
          </tbody>
        </TableWrap>
      </div>
      {/* mobile cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {tasks.map((t) => {
          const ed = canEditTask(me, t) && !deletedMode;
          return (
            <li key={t.id} className={cn("p-3", t.isOverdue && "bg-rose-50/40", issueRowClass(t))}>
              <button className="block w-full text-left" onClick={() => open(t.id)}>
                <span className="block text-[11px] text-slate-400">{t.id} · {projectName(t.projectId)}</span>
                <span className="flex items-center gap-2 text-sm font-medium text-slate-900"><TypeBadge value={t.type} />{t.title}</span>
              </button>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusMenu value={t.status} disabled={!ed} onChange={(s) => change(t.id, { status: s })} />
                <PriorityMenu value={t.priority} disabled={!ed} onChange={(s) => change(t.id, { priority: s })} />
                <DueDate task={t} />
                <span className="ml-auto">{people(t)[0] && <Avatar name={people(t)[0].name} size={22} />}</span>
              </div>
              {deletedMode && manage && <Button size="xs" variant="outline" className="mt-2" onClick={() => restore(t.id)}>Restore</Button>}
            </li>
          );
        })}
      </ul>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPage={onPage} />
    </Card>
  );
}
