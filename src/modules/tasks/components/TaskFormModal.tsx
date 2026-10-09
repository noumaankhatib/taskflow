"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, enumOptions } from "@/components/ui/form";
import { Notice } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/overlay";
import { TagInput, UserMultiSelect, UserSelect } from "@/components/ui/pickers";
import { useToast } from "@/components/ui/toast";
import { ApiError, api, messageOf } from "@/lib/api";
import { useLookup } from "@/lib/lookups";
import { PRIORITIES } from "@/schemas/common";
import { TASK_STATUSES } from "@/schemas/entities";
import { label } from "@/utils/format";
import { invalidateTasks, projectPeople, type TaskView } from "./shared";

interface Props { open: boolean; onClose: () => void; projectId?: string; task?: TaskView; defaultStatus?: string; onSaved?: (t: TaskView) => void }

const blank = (projectId = "", status = "TODO") => ({
  projectId, title: "", description: "", status, priority: "MEDIUM", startDate: "", dueDate: "", estimatedHours: "0",
  primaryOwnerId: null as string | null, contributorIds: [] as string[], tags: [] as string[],
});

export function TaskFormModal({ open, onClose, projectId, task, defaultStatus, onSaved }: Props) {
  const toast = useToast();
  const { projects, projectsById, users } = useLookup();
  const [f, setF] = useState(blank(projectId, defaultStatus));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({}); setFormError(null);
    setF(task ? {
      projectId: task.projectId, title: task.title, description: task.description, status: task.status, priority: task.priority,
      startDate: task.startDate ?? "", dueDate: task.dueDate ?? "", estimatedHours: String(task.estimatedHours),
      primaryOwnerId: task.primaryOwnerId, contributorIds: task.contributorIds, tags: task.tags,
    } : blank(projectId, defaultStatus));
  }, [open, task, projectId, defaultStatus]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const people = projectPeople(projectsById.get(f.projectId), users);
  const openProjects = projects.filter((p) => !p.isDeleted);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!f.projectId) local.projectId = "Select a project";
    if (!f.title.trim()) local.title = "Title is required";
    if (Number.isNaN(Number(f.estimatedHours)) || Number(f.estimatedHours) < 0) local.estimatedHours = "Enter a valid number of hours";
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true); setFormError(null);
    const body = {
      title: f.title, description: f.description, status: f.status, priority: f.priority,
      startDate: f.startDate, dueDate: f.dueDate, estimatedHours: Number(f.estimatedHours) || 0,
      tags: f.tags, primaryOwnerId: f.primaryOwnerId, contributorIds: f.contributorIds.filter((c) => c !== f.primaryOwnerId),
    };
    try {
      const saved = task ? await api.put<TaskView>(`/api/tasks/${task.id}`, body) : await api.post<TaskView>("/api/tasks", { ...body, projectId: f.projectId });
      await invalidateTasks();
      toast.success(task ? "Task updated" : "Task created");
      onSaved?.(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        const fe: Record<string, string> = {};
        for (const i of err.details as { path: string; message: string }[]) if (i.path) fe[i.path] = i.message;
        setErrors(fe);
      }
      setFormError(messageOf(err));
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={task ? `Edit ${task.id}` : "New task"} size="lg"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="task-form" loading={busy}>{task ? "Save changes" : "Create task"}</Button></>}>
      <form id="task-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {formError && <div className="sm:col-span-2"><Notice tone="error">{formError}</Notice></div>}
        {!projectId && !task && (
          <Select wrapperClassName="sm:col-span-2" label="Project" required value={f.projectId} error={errors.projectId}
            onChange={(e) => setF((s) => ({ ...s, projectId: e.target.value, primaryOwnerId: null, contributorIds: [] }))}>
            <option value="">Select a project…</option>
            {openProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
        <Input wrapperClassName="sm:col-span-2" label="Title" required autoFocus value={f.title} error={errors.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
        <Textarea wrapperClassName="sm:col-span-2" label="Description" value={f.description} rows={3} onChange={(e) => set("description", e.target.value)} />
        <Select label="Status" value={f.status} onChange={(e) => set("status", e.target.value)}>{enumOptions(TASK_STATUSES, label)}</Select>
        <Select label="Priority" value={f.priority} onChange={(e) => set("priority", e.target.value)}>{enumOptions(PRIORITIES, label)}</Select>
        <Input label="Start date" type="date" value={f.startDate} error={errors.startDate} onChange={(e) => set("startDate", e.target.value)} />
        <Input label="Due date" type="date" value={f.dueDate} error={errors.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
        <Input label="Estimated hours" type="number" min={0} step="0.5" value={f.estimatedHours} error={errors.estimatedHours} onChange={(e) => set("estimatedHours", e.target.value)} />
        <TagInput label="Tags" value={f.tags} onChange={(t) => set("tags", t)} />
        <UserSelect label="Primary owner" value={f.primaryOwnerId} people={people} onChange={(id) => setF((s) => ({ ...s, primaryOwnerId: id, contributorIds: s.contributorIds.filter((c) => c !== id) }))}
          placeholder={f.projectId ? "Unassigned" : "Pick a project first"} disabled={!f.projectId} error={errors.primaryOwnerId} />
        <UserMultiSelect label="Contributors" value={f.contributorIds} people={people} exclude={[f.primaryOwnerId]} onChange={(ids) => set("contributorIds", ids)} error={errors.contributorIds} placeholder={f.projectId ? "Add contributors" : "Pick a project first"} />
      </form>
    </Modal>
  );
}
