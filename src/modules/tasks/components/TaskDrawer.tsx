"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Download, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Activity, Attachment, Comment, Subtask, TimeEntry } from "@/schemas/entities";
import { Button, IconButton } from "@/components/ui/Button";
import { Avatar, Badge, ProgressBar, Tabs } from "@/components/ui/display";
import { Checkbox, Input, Textarea } from "@/components/ui/form";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Drawer, useConfirm } from "@/components/ui/overlay";
import { Menu } from "@/components/ui/menu";
import { TagInput, UserMultiSelect, UserSelect } from "@/components/ui/pickers";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useCan, useLookup, useMe } from "@/lib/lookups";
import { formatDate, timeAgo } from "@/utils/format";
import { TaskFormModal } from "./TaskFormModal";
import { PriorityMenu, StatusMenu, TypeMenu, canEditTask, invalidateTasks, projectPeople, updateTask, type TaskView } from "./shared";

type Detail = TaskView & { subtasks: Subtask[] };
type TabId = "details" | "activity";

export function TaskDrawer({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { data, error, isLoading, reload } = useApi<Detail>(taskId ? `/api/tasks/${taskId}` : null, { keepPreviousData: false });
  return (
    <Drawer open={!!taskId} onClose={onClose} width="max-w-2xl"
      subtitle={taskId} title={data?.title ?? (isLoading ? "Loading…" : "Task")}>
      {isLoading && !data ? <div className="space-y-3 p-5"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
        : error || !data ? <ErrorState error={error ?? new Error("Task not found.")} onRetry={reload} />
        : <Body key={data.id} task={data} reload={reload} onClose={onClose} />}
    </Drawer>
  );
}

function Body({ task, reload, onClose }: { task: Detail; reload: () => void; onClose: () => void }) {
  const me = useMe();
  const toast = useToast();
  const confirm = useConfirm();
  const { projectsById, users, projectName } = useLookup();
  const manage = useCan("task:manage");
  const editable = canEditTask(me, task);
  const [tab, setTab] = useState<TabId>("details");
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [desc, setDesc] = useState(task.description);
  const [est, setEst] = useState(String(task.estimatedHours));
  const people = projectPeople(projectsById.get(task.projectId), users);

  useEffect(() => { setTitle(task.title); setDesc(task.description); setEst(String(task.estimatedHours)); }, [task.updatedAt, task.title, task.description, task.estimatedHours]);

  async function patch(p: Record<string, unknown>, ok?: string) {
    try { await updateTask(task.id, p); await reload(); if (ok) toast.success(ok); }
    catch (e) { toast.error(e); setTitle(task.title); setDesc(task.description); setEst(String(task.estimatedHours)); }
  }
  async function remove() {
    if (!(await confirm({ title: "Delete this task?", message: "It will be hidden from boards and reports. A project manager can restore it.", confirmLabel: "Delete task", destructive: true }))) return;
    try { await api.del(`/api/tasks/${task.id}`); await invalidateTasks(); toast.success("Task deleted"); onClose(); } catch (e) { toast.error(e); }
  }

  const pct = task.estimatedHours > 0 ? (task.actualHours / task.estimatedHours) * 100 : 0;
  const over = task.estimatedHours > 0 && task.actualHours > task.estimatedHours;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <StatusMenu value={task.status} disabled={!editable} onChange={(s) => patch({ status: s }, "Status updated")} />
        <TypeMenu value={task.type} disabled={!editable} onChange={(s) => patch({ type: s }, "Type updated")} />
        <PriorityMenu value={task.priority} disabled={!editable} onChange={(s) => patch({ priority: s }, "Priority updated")} />
        {task.isOverdue && <Badge tone="rose">Overdue</Badge>}
        {!editable && <Badge tone="zinc">Read-only</Badge>}
        <div className="ml-auto flex gap-1">
          {editable && <Button size="sm" variant="outline" icon={<Pencil className="size-3.5" />} onClick={() => setEditOpen(true)}>Edit</Button>}
          {(manage || (editable && task.createdBy === me.id)) && <IconButton label="Delete task" onClick={remove}><Trash2 className="size-4 text-rose-500" /></IconButton>}
        </div>
      </div>
      <div className="px-4 pt-2 sm:px-5"><Tabs<TabId> tabs={[{ id: "details", label: "Details" }, { id: "activity", label: "Activity" }]} value={tab} onChange={setTab} /></div>

      {tab === "activity" ? <ActivityTab taskId={task.id} /> : (
        <div className="space-y-6 p-4 sm:p-5">
          <div className="space-y-3">
            <input aria-label="Task title" value={title} disabled={!editable} onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title !== task.title && patch({ title })}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-full rounded-lg border border-transparent px-2 py-1 text-lg font-semibold text-slate-900 hover:border-slate-200 focus:border-indigo-500 focus:outline-none disabled:hover:border-transparent" />
            <Textarea aria-label="Description" placeholder={editable ? "Add a description…" : "No description"} rows={3} value={desc} disabled={!editable}
              onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== task.description && patch({ description: desc })} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs font-medium text-slate-600">Project</span>
              <Link href={`/projects/${task.projectId}`} className="text-sm font-medium text-indigo-600 hover:underline">{projectName(task.projectId)}</Link>
            </div>
            <div><span className="mb-1 block text-xs font-medium text-slate-600">Created</span><span className="text-sm text-slate-700">{formatDate(task.createdAt)}</span></div>
            <UserSelect label="Primary owner" value={task.primaryOwnerId} people={people} disabled={!manage}
              onChange={(id) => patch({ primaryOwnerId: id, contributorIds: task.contributorIds.filter((c) => c !== id) }, "Owner updated")} />
            {manage ? (
              <UserMultiSelect label="Contributors" value={task.contributorIds} people={people} exclude={[task.primaryOwnerId]} onChange={(ids) => patch({ contributorIds: ids }, "Contributors updated")} />
            ) : (
              <div><span className="mb-1 block text-xs font-medium text-slate-600">Contributors</span>
                {task.contributorIds.length ? <div className="flex flex-wrap gap-2">{task.contributorIds.map((id) => <span key={id} className="inline-flex items-center gap-1.5 text-sm"><Avatar name={users.find((u) => u.id === id)?.name ?? id} size={20} />{users.find((u) => u.id === id)?.name ?? id}</span>)}</div> : <span className="text-sm text-slate-400">None</span>}
              </div>
            )}
            <Input label="Start date" type="date" value={task.startDate ?? ""} disabled={!editable} onChange={(e) => patch({ startDate: e.target.value })} />
            <Input label="Due date" type="date" value={task.dueDate ?? ""} disabled={!editable} onChange={(e) => patch({ dueDate: e.target.value })} />
            <Input label="Estimated hours" type="number" min={0} step="0.5" value={est} disabled={!editable} onChange={(e) => setEst(e.target.value)}
              onBlur={() => Number(est) >= 0 && Number(est) !== task.estimatedHours && patch({ estimatedHours: Number(est) })} />
            <TagInput label="Tags" value={task.tags} onChange={(t) => editable && patch({ tags: t })} />
          </div>

          <section aria-label="Hours" className="rounded-xl border border-slate-200 p-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-slate-900">Hours</span>
              <span className="text-slate-600">Estimated <b>{task.estimatedHours}h</b> · Actual <b className={over ? "text-rose-600" : ""}>{task.actualHours}h</b> · Remaining <b>{task.remainingHours}h</b></span>
            </div>
            <ProgressBar value={pct} tone={over ? "rose" : pct > 80 ? "amber" : "indigo"} label="Hours used" />
          </section>

          <Subtasks task={task} editable={editable} reload={reload} />
          <TimeLog task={task} reload={reload} />
          <Comments taskId={task.id} />
          <Files task={task} editable={editable} />
        </div>
      )}
      <TaskFormModal open={editOpen} onClose={() => setEditOpen(false)} task={task} onSaved={() => reload()} />
    </div>
  );
}

const Section = ({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) => (
  <section><div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-900">{title}</h3>{right}</div>{children}</section>
);

function ActivityTab({ taskId }: { taskId: string }) {
  const { data, error, isLoading, reload } = useApi<Activity[]>(`/api/tasks/${taskId}/activity`);
  return <div className="p-4 sm:p-5">{isLoading ? <Skeleton className="h-40" /> : error ? <ErrorState error={error} onRetry={reload} /> : <ActivityTimeline items={data ?? []} />}</div>;
}

/* ------------------------------ subtasks ------------------------------ */
function Subtasks({ task, editable, reload }: { task: Detail; editable: boolean; reload: () => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const done = task.subtasks.filter((s) => s.completed).length;
  const base = `/api/tasks/${task.id}/subtasks`;
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); await reload(); await invalidateTasks(); } catch (e) { toast.error(e); } };

  return (
    <Section title="Subtasks" right={task.subtasks.length > 0 && <span className="text-xs text-slate-500">{done} / {task.subtasks.length} completed</span>}>
      {task.subtasks.length > 0 && <ProgressBar value={(done / task.subtasks.length) * 100} tone="emerald" className="mb-2" label="Subtasks completed" />}
      <ul className="space-y-0.5">
        {task.subtasks.map((s) => (
          <li key={s.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-50">
            <input type="checkbox" aria-label={`Complete ${s.title}`} checked={s.completed} disabled={!editable} className="size-4 rounded border-slate-300 text-emerald-600"
              onChange={(e) => run(() => api.put(`${base}/${s.id}`, { completed: e.target.checked }))} />
            {editing === s.id ? (
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Subtask title"
                onKeyDown={(e) => { if (e.key === "Enter") { setEditing(null); if (draft.trim() && draft !== s.title) run(() => api.put(`${base}/${s.id}`, { title: draft })); } if (e.key === "Escape") setEditing(null); }}
                onBlur={() => setEditing(null)} className="flex-1 rounded border border-indigo-400 px-1.5 py-0.5 text-sm outline-none" />
            ) : (
              <span className={cn("flex-1 text-sm", s.completed ? "text-slate-400 line-through" : "text-slate-800")} onDoubleClick={() => editable && (setEditing(s.id), setDraft(s.title))}>{s.title}</span>
            )}
            {editable && editing !== s.id && (
              <span className="flex opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <IconButton label="Rename subtask" className="!size-7" onClick={() => { setEditing(s.id); setDraft(s.title); }}><Pencil className="size-3.5" /></IconButton>
                <IconButton label="Delete subtask" className="!size-7" onClick={() => run(() => api.del(`${base}/${s.id}`))}><X className="size-3.5" /></IconButton>
              </span>
            )}
          </li>
        ))}
      </ul>
      {!task.subtasks.length && <p className="text-sm text-slate-400">No subtasks yet.</p>}
      {editable && (
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t) { setText(""); run(() => api.post(base, { title: t })); } }}>
          <input aria-label="New subtask" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a subtask…" className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          <Button type="submit" variant="outline" icon={<Plus className="size-4" />} disabled={!text.trim()}>Add</Button>
        </form>
      )}
    </Section>
  );
}

/* ------------------------------ time ------------------------------ */
function TimeLog({ task, reload }: { task: Detail; reload: () => void }) {
  const me = useMe();
  const toast = useToast();
  const confirm = useConfirm();
  const canLog = useCan("time:write");
  const manage = useCan("task:manage");
  const { userName } = useLookup();
  const { data, reload: reloadEntries } = useApi<TimeEntry[]>(`/api/time-entries?taskId=${task.id}`);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), hours: "", description: "", billable: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const hours = Number(f.hours);
    if (!(hours > 0)) return setErr("Hours must be greater than zero");
    setBusy(true); setErr(null);
    try {
      await api.post("/api/time-entries", { taskId: task.id, date: f.date, hours, description: f.description, billable: f.billable });
      setF((s) => ({ ...s, hours: "", description: "" })); setOpen(false);
      await Promise.all([reloadEntries(), reload(), invalidateTasks()]);
      toast.success("Time logged");
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Unable to log time"); } finally { setBusy(false); }
  }
  async function del(id: string) {
    if (!(await confirm({ title: "Delete time entry?", destructive: true, confirmLabel: "Delete" }))) return;
    try { await api.del(`/api/time-entries/${id}`); await Promise.all([reloadEntries(), reload(), invalidateTasks()]); } catch (e) { toast.error(e); }
  }

  return (
    <Section title="Time entries" right={canLog && <Button size="xs" variant="outline" icon={<Plus className="size-3.5" />} onClick={() => setOpen((o) => !o)}>Log time</Button>}>
      {open && (
        <form onSubmit={submit} className="mb-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-3">
          <Input label="Date" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          <Input label="Hours" type="number" min={0.25} max={24} step="0.25" required autoFocus value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} />
          <div className="flex items-end pb-2"><Checkbox label="Billable" checked={f.billable} onChange={(e) => setF({ ...f, billable: e.target.checked })} /></div>
          <Input wrapperClassName="sm:col-span-3" label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What did you work on?" />
          {err && <p role="alert" className="text-xs text-rose-600 sm:col-span-3">{err}</p>}
          <div className="flex justify-end gap-2 sm:col-span-3"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={busy}>Save entry</Button></div>
        </form>
      )}
      {data?.length ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {data.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-14 shrink-0 font-semibold tabular-nums text-slate-900">{t.hours}h</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-slate-700">{t.description || "No description"}</span><span className="text-xs text-slate-400">{userName(t.userId)} · {formatDate(t.date)}{!t.billable && " · non-billable"}</span></span>
              {(t.userId === me.id || manage) && canLog && <IconButton label="Delete entry" className="!size-7" onClick={() => del(t.id)}><Trash2 className="size-3.5" /></IconButton>}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-slate-400">No time logged yet.</p>}
    </Section>
  );
}

/* ------------------------------ comments ------------------------------ */
function Mentions({ text }: { text: string }) {
  return <>{text.split(/(@[\p{L}\p{N}_.-]+)/u).map((p, i) => p.startsWith("@") ? <span key={i} className="rounded bg-indigo-50 px-1 font-medium text-indigo-700">{p}</span> : <span key={i}>{p}</span>)}</>;
}

function Comments({ taskId }: { taskId: string }) {
  const me = useMe();
  const toast = useToast();
  const confirm = useConfirm();
  const canComment = useCan("comment:write");
  const manage = useCan("task:manage");
  const { usersById } = useLookup();
  const { data, isLoading, reload } = useApi<Comment[]>(`/api/tasks/${taskId}/comments`);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const refresh = () => Promise.all([reload(), invalidateTasks()]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try { await api.post(`/api/tasks/${taskId}/comments`, { message: text }); setText(""); await refresh(); } catch (e) { toast.error(e); } finally { setBusy(false); }
  }
  async function saveEdit(id: string) {
    try { await api.put(`/api/tasks/${taskId}/comments/${id}`, { message: draft }); setEditing(null); await refresh(); } catch (e) { toast.error(e); }
  }
  async function del(id: string) {
    if (!(await confirm({ title: "Delete comment?", destructive: true, confirmLabel: "Delete" }))) return;
    try { await api.del(`/api/tasks/${taskId}/comments/${id}`); await refresh(); } catch (e) { toast.error(e); }
  }

  return (
    <Section title={`Comments${data?.length ? ` (${data.length})` : ""}`}>
      {isLoading && <Skeleton className="h-16" />}
      <ul className="space-y-3">
        {(data ?? []).map((c) => {
          const u = usersById.get(c.userId);
          return (
            <li key={c.id} className="flex gap-2.5">
              <Avatar name={u?.name ?? c.userId} src={u?.avatar} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs"><span className="font-medium text-slate-800">{u?.name ?? c.userId}</span><span className="text-slate-400">{timeAgo(c.createdAt)}{c.updatedAt !== c.createdAt && " · edited"}</span>
                  {(c.userId === me.id || manage) && (
                    <span className="ml-auto"><Menu label="Comment actions" items={[{ label: "Edit", hidden: c.userId !== me.id, onSelect: () => { setEditing(c.id); setDraft(c.message); } }, { label: "Delete", danger: true, onSelect: () => del(c.id) }]} /></span>)}
                </div>
                {editing === c.id ? (
                  <div className="mt-1 space-y-2">
                    <Textarea aria-label="Edit comment" value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveEdit(c.id); if (e.key === "Escape") { e.stopPropagation(); setEditing(null); } }} />
                    <div className="flex gap-2"><Button size="sm" onClick={() => saveEdit(c.id)} icon={<Check className="size-3.5" />}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
                  </div>
                ) : <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-700"><Mentions text={c.message} /></p>}
              </div>
            </li>
          );
        })}
      </ul>
      {!isLoading && !data?.length && <p className="text-sm text-slate-400">No comments yet.</p>}
      {canComment && (
        <div className="mt-3 space-y-2">
          <Textarea aria-label="Add a comment" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment… use @Name to mention (Ctrl+Enter to send)"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }} />
          <div className="flex justify-end"><Button size="sm" onClick={send} loading={busy} disabled={!text.trim()}>Comment</Button></div>
        </div>
      )}
    </Section>
  );
}

/* ------------------------------ attachments ------------------------------ */
function Files({ task, editable }: { task: Detail; editable: boolean }) {
  const me = useMe();
  const toast = useToast();
  const confirm = useConfirm();
  const manage = useCan("task:manage");
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { data, reload } = useApi<Attachment[]>(`/api/attachments?entityType=TASK&entityId=${task.id}`);

  async function upload(file: File) {
    const form = new FormData();
    form.set("file", file); form.set("projectId", task.projectId); form.set("entityType", "TASK"); form.set("entityId", task.id);
    setBusy(true);
    try { await api.upload("/api/attachments", form); await Promise.all([reload(), invalidateTasks()]); toast.success("File uploaded"); } catch (e) { toast.error(e); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  async function del(a: Attachment) {
    if (!(await confirm({ title: `Remove ${a.fileName}?`, destructive: true, confirmLabel: "Remove" }))) return;
    try { await api.del(`/api/attachments/${a.id}`); await Promise.all([reload(), invalidateTasks()]); } catch (e) { toast.error(e); }
  }
  const size = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  return (
    <Section title="Attachments" right={editable && <>
      <input ref={input} type="file" className="hidden" aria-label="Upload file" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <Button size="xs" variant="outline" loading={busy} icon={<Paperclip className="size-3.5" />} onClick={() => input.current?.click()}>Attach file</Button></>}>
      {data?.length ? (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {data.map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Paperclip className="size-4 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1"><span className="block truncate text-slate-800">{a.fileName}</span><span className="text-xs text-slate-400">{size(a.size)} · {timeAgo(a.createdAt)}</span></span>
              <a href={`/api/attachments/${a.id}`} aria-label={`Download ${a.fileName}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><Download className="size-4" /></a>
              {(a.uploadedBy === me.id || manage) && <IconButton label="Remove file" className="!size-7" onClick={() => del(a)}><Trash2 className="size-3.5" /></IconButton>}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-slate-400">No files attached.</p>}
    </Section>
  );
}

