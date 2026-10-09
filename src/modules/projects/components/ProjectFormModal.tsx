"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, enumOptions } from "@/components/ui/form";
import { UserMultiSelect, UserSelect } from "@/components/ui/pickers";
import { Notice } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, messageOf } from "@/lib/api";
import { invalidate } from "@/lib/hooks";
import { useLookup } from "@/lib/lookups";
import { PRIORITIES } from "@/schemas/common";
import { PROJECT_STATUSES } from "@/schemas/entities";
import { label } from "@/utils/format";
import type { ProjectView } from "./types";

interface FormState {
  name: string; clientId: string; description: string; status: string; priority: string;
  startDate: string; expectedEndDate: string; actualEndDate: string; budget: string; contractValue: string;
  projectManagerId: string | null; memberIds: string[];
}
const empty: FormState = {
  name: "", clientId: "", description: "", status: "PLANNING", priority: "MEDIUM", startDate: "", expectedEndDate: "", actualEndDate: "",
  budget: "", contractValue: "", projectManagerId: null, memberIds: [],
};
const fromProject = (p: ProjectView): FormState => ({
  name: p.name, clientId: p.clientId, description: p.description, status: p.status, priority: p.priority,
  startDate: p.startDate ?? "", expectedEndDate: p.expectedEndDate ?? "", actualEndDate: p.actualEndDate ?? "",
  budget: String(p.budget), contractValue: String(p.contractValue), projectManagerId: p.projectManagerId, memberIds: p.memberIds,
});

export function ProjectFormModal({ open, onClose, project, onSaved }: { open: boolean; onClose: () => void; project?: ProjectView | null; onSaved?: (p: ProjectView) => void }) {
  const { clients, reload } = useLookup();
  const toast = useToast();
  const [f, setF] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setF(project ? fromProject(project) : empty); setErrors({}); setFormError(null); }
  }, [open, project]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  function validate() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "Project name is required";
    if (!f.clientId) e.clientId = "Select a client";
    if (f.startDate && f.expectedEndDate && f.startDate > f.expectedEndDate) e.expectedEndDate = "Expected end date cannot be before start date";
    for (const k of ["budget", "contractValue"] as const) if (f[k] !== "" && !(Number(f[k]) >= 0)) e[k] = "Must be zero or more";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setFormError(null);
    const body = {
      name: f.name.trim(), clientId: f.clientId, description: f.description, status: f.status, priority: f.priority,
      startDate: f.startDate, expectedEndDate: f.expectedEndDate, actualEndDate: f.actualEndDate,
      budget: Number(f.budget || 0), contractValue: Number(f.contractValue || 0),
      projectManagerId: f.projectManagerId ?? "", memberIds: f.memberIds,
    };
    try {
      const saved = project ? await api.put<ProjectView>(`/api/projects/${project.id}`, body) : await api.post<ProjectView>("/api/projects", body);
      toast.success(project ? "Project updated" : "Project created");
      await Promise.all([invalidate("/api/projects", "/api/dashboard", "/api/activity"), reload()]);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setFormError(err.message);
      else setFormError(messageOf(err));
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={project ? `Edit ${project.id}` : "New project"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="project-form" loading={busy}>{project ? "Save changes" : "Create project"}</Button></>}>
      <form id="project-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {formError && <Notice tone="error" className="sm:col-span-2">{formError}</Notice>}
        <Input wrapperClassName="sm:col-span-2" label="Project name" required value={f.name} onChange={(e) => set("name", e.target.value)} error={errors.name} autoFocus />
        <Select label="Client" required value={f.clientId} onChange={(e) => set("clientId", e.target.value)} error={errors.clientId}>
          <option value="">Select client…</option>
          {clients.filter((c) => c.active || c.id === project?.clientId).map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
        </Select>
        <UserSelect label="Project manager" value={f.projectManagerId} onChange={(v) => set("projectManagerId", v)} placeholder="No manager" />
        <Select label="Status" value={f.status} onChange={(e) => set("status", e.target.value)}>{enumOptions(PROJECT_STATUSES, label)}</Select>
        <Select label="Priority" value={f.priority} onChange={(e) => set("priority", e.target.value)}>{enumOptions(PRIORITIES, label)}</Select>
        <Input type="date" label="Start date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
        <Input type="date" label="Expected end date" value={f.expectedEndDate} onChange={(e) => set("expectedEndDate", e.target.value)} error={errors.expectedEndDate} />
        <Input type="date" label="Actual end date" value={f.actualEndDate} onChange={(e) => set("actualEndDate", e.target.value)} hint="Set automatically when completed" />
        <div className="hidden sm:block" />
        <Input type="number" min={0} step="any" inputMode="decimal" label="Contract value (₹)" value={f.contractValue} onChange={(e) => set("contractValue", e.target.value)} error={errors.contractValue} />
        <Input type="number" min={0} step="any" inputMode="decimal" label="Project budget (₹)" value={f.budget} onChange={(e) => set("budget", e.target.value)} error={errors.budget} hint="Internal cost budget" />
        <div className="sm:col-span-2"><UserMultiSelect label="Team members" value={f.memberIds} onChange={(v) => set("memberIds", v)} /></div>
        <Textarea wrapperClassName="sm:col-span-2" label="Description" rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} />
      </form>
    </Modal>
  );
}
