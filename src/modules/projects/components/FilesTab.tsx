"use client";
import { useRef, useState } from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import type { Attachment } from "@/schemas/entities";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { useConfirm } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { invalidate, useApi } from "@/lib/hooks";
import { useCan, useLookup, useMe } from "@/lib/lookups";
import { formatDate } from "@/utils/format";
import type { ProjectView } from "./types";

const MAX = 10 * 1024 * 1024;
const size = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function FilesTab({ project }: { project: ProjectView }) {
  const { userName } = useLookup();
  const me = useMe();
  const canTask = useCan("task:write");
  const canProject = useCan("project:write");
  const canExpense = useCan("expense:write");
  const canUpload = canTask || canProject || canExpense;
  const canManage = useCan("task:manage");
  const toast = useToast();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const { data, error, isLoading, reload } = useApi<Attachment[]>(`/api/attachments?projectId=${project.id}`);

  async function upload(files: FileList | File[]) {
    setBusy(true);
    for (const file of Array.from(files)) {
      if (file.size > MAX) { toast.error(`${file.name} is larger than the 10 MB limit.`); continue; }
      const form = new FormData();
      form.set("file", file); form.set("projectId", project.id); form.set("entityType", "PROJECT"); form.set("entityId", project.id);
      try { await api.upload("/api/attachments", form); toast.success(`${file.name} uploaded`); } catch (e) { toast.error(e); }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    await Promise.all([reload(), invalidate("/api/projects")]);
  }
  async function remove(a: Attachment) {
    if (!(await confirm({ title: `Delete ${a.fileName}?`, message: "This file will no longer be available.", confirmLabel: "Delete", destructive: true }))) return;
    try { await api.del(`/api/attachments/${a.id}`); toast.success("File deleted"); await reload(); } catch (e) { toast.error(e); }
  }

  return (
    <Card>
      <CardHeader title="Project files" description="Contracts, briefs and deliverables. Max 10 MB per file."
        action={canUpload && !project.isDeleted && <><input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} /><Button size="sm" icon={<Upload className="size-4" />} loading={busy} onClick={() => input.current?.click()}>Upload</Button></>} />
      {canUpload && !project.isDeleted && (
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
          className={`mb-4 hidden rounded-lg border-2 border-dashed p-4 text-center text-sm sm:block ${drag ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-400"}`}>Drag files here to upload</div>
      )}
      {isLoading && !data ? <TableSkeleton rows={3} cols={3} /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.length ? (
        <EmptyState icon={<FileText className="size-5" />} title="No files yet" description="Upload documents to keep everything about this project in one place." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-3">
              <FileText className="size-5 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-slate-900">{a.fileName}</div><div className="truncate text-xs text-slate-500">{size(a.size)} · {userName(a.uploadedBy)} · {formatDate(a.createdAt)}{a.entityType !== "PROJECT" && ` · ${a.entityType.toLowerCase()} ${a.entityId}`}</div></div>
              <a href={`/api/attachments/${a.id}`} download aria-label={`Download ${a.fileName}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Download className="size-4" /></a>
              {(a.uploadedBy === me.id || canManage) && <Button variant="ghost" size="xs" aria-label={`Delete ${a.fileName}`} onClick={() => remove(a)}><Trash2 className="size-4 text-rose-500" /></Button>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
