"use client";
import { useEffect, useState } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { CheckSquare, GripVertical, MessageSquare, Paperclip, Plus } from "lucide-react";
import { AvatarStack, Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/toast";
import { dotClasses, taskStatusTone, TASK_BOARD_COLUMNS } from "@/lib/status";
import { useCan, useLookup, useMe } from "@/lib/lookups";
import { label } from "@/utils/format";
import { DueDate, PriorityBadge, TypeBadge, StatusMenu, canEditTask, updateTask, type TaskView } from "./shared";

interface Props { tasks: TaskView[]; showExtra: boolean; onOpen: (id: string) => void; onCreate?: (status: string) => void }

export function TaskBoard({ tasks, showExtra, onOpen, onCreate }: Props) {
  const toast = useToast();
  const me = useMe();
  const [local, setLocal] = useState(tasks);
  const [dragging, setDragging] = useState<TaskView | null>(null);
  useEffect(() => setLocal(tasks), [tasks]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const columns = showExtra ? [...TASK_BOARD_COLUMNS, "BLOCKED", "CANCELLED"] : [...TASK_BOARD_COLUMNS];

  async function move(id: string, status: string) {
    const t = local.find((x) => x.id === id);
    if (!t || t.status === status) return;
    const prev = local;
    setLocal((l) => l.map((x) => (x.id === id ? { ...x, status: status as TaskView["status"] } : x))); // optimistic
    try { await updateTask(id, { status }); toast.success(`Moved to ${label(status)}`); }
    catch (e) { setLocal(prev); toast.error(e); }
  }
  const onEnd = (e: DragEndEvent) => {
    setDragging(null);
    const to = e.over?.id as string | undefined;
    if (to) move(String(e.active.id), to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => setDragging(local.find((t) => t.id === e.active.id) ?? null)} onDragEnd={onEnd} onDragCancel={() => setDragging(null)}>
      <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-3 sm:mx-0 sm:px-0">
        {columns.map((s) => <Column key={s} status={s} tasks={local.filter((t) => t.status === s)} me={me} onOpen={onOpen} onCreate={onCreate} onMove={move} />)}
      </div>
      <DragOverlay>{dragging && <div className="w-72 rotate-1 opacity-95"><Card task={dragging} editable onOpen={() => {}} onMove={() => {}} overlay /></div>}</DragOverlay>
    </DndContext>
  );
}

function Column({ status, tasks, me, onOpen, onCreate, onMove }: { status: string; tasks: TaskView[]; me: ReturnType<typeof useMe>; onOpen: (id: string) => void; onCreate?: (s: string) => void; onMove: (id: string, s: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const canCreate = useCan("task:write");
  return (
    <section ref={setNodeRef} aria-label={`${label(status)} column`}
      className={cn("flex w-[85vw] max-w-80 shrink-0 snap-start flex-col rounded-xl border bg-slate-100/70 sm:w-72", isOver ? "border-indigo-400 bg-indigo-50/60" : "border-slate-200")}>
      <header className="flex items-center gap-2 px-3 py-2.5">
        <span className={cn("size-2 rounded-full", dotClasses[taskStatusTone[status] ?? "slate"])} />
        <h3 className="text-sm font-semibold text-slate-800">{label(status)}</h3>
        <Badge tone="slate">{tasks.length}</Badge>
        {onCreate && canCreate && <button aria-label={`Add task to ${label(status)}`} onClick={() => onCreate(status)} className="ml-auto rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"><Plus className="size-4" /></button>}
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {tasks.map((t) => <DraggableCard key={t.id} task={t} editable={canEditTask(me, t)} onOpen={onOpen} onMove={onMove} />)}
        {!tasks.length && <div className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400">Drop tasks here</div>}
      </div>
    </section>
  );
}

function DraggableCard({ task, editable, onOpen, onMove }: { task: TaskView; editable: boolean; onOpen: (id: string) => void; onMove: (id: string, s: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !editable });
  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <Card task={task} editable={editable} onOpen={() => onOpen(task.id)} onMove={(s) => onMove(task.id, s)} handle={editable ? { ...attributes, ...listeners } : undefined} />
    </div>
  );
}

function Card({ task, editable, onOpen, onMove, handle, overlay }: { task: TaskView; editable: boolean; onOpen: () => void; onMove: (s: string) => void; handle?: object; overlay?: boolean }) {
  const { projectName, usersById } = useLookup();
  const people = [task.primaryOwnerId, ...task.contributorIds].filter(Boolean).map((id) => {
    const u = usersById.get(id!);
    return { id: id!, name: u?.name ?? id!, avatar: u?.avatar };
  });
  return (
    <article className={cn("group rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md", task.isOverdue ? "border-rose-200" : "border-slate-200", overlay && "shadow-lg")}>
      <div className="flex items-start gap-1.5">
        {handle && <button aria-label={`Drag ${task.title}`} {...handle} className="-ml-1 mt-0.5 cursor-grab touch-none rounded p-0.5 text-slate-300 hover:text-slate-500 active:cursor-grabbing"><GripVertical className="size-4" /></button>}
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="block text-[11px] text-slate-400">{task.id} · {projectName(task.projectId)}</span>
          <span className="mt-0.5 block text-sm font-medium leading-snug text-slate-900">{task.title}</span>
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1"><TypeBadge value={task.type} /><PriorityBadge value={task.priority} /></span>
        {task.tags.slice(0, 2).map((t) => <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{t}</span>)}
        {task.tags.length > 2 && <span className="text-[11px] text-slate-400">+{task.tags.length - 2}</span>}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <DueDate task={task} />
        {people.length ? <AvatarStack people={people} size={22} max={3} /> : <span className="text-[11px] text-slate-400">Unassigned</span>}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
        {task.subtaskTotal > 0 && <span className="inline-flex items-center gap-1" title="Subtasks completed"><CheckSquare className="size-3.5" />{task.subtaskDone}/{task.subtaskTotal}</span>}
        {task.commentCount > 0 && <span className="inline-flex items-center gap-1" title="Comments"><MessageSquare className="size-3.5" />{task.commentCount}</span>}
        {task.attachmentCount > 0 && <span className="inline-flex items-center gap-1" title="Attachments"><Paperclip className="size-3.5" />{task.attachmentCount}</span>}
        <span className="ml-auto" onClick={(e) => e.stopPropagation()}><StatusMenu value={task.status} disabled={!editable || overlay} onChange={onMove} /></span>
      </div>
    </article>
  );
}

export function BoardEmpty({ action }: { action?: React.ReactNode }) {
  return <EmptyState title="No tasks match" description="Try adjusting your filters, or create a new task." action={action} />;
}
