"use client";
import { useRef, useState } from "react";
import { mutate as globalMutate } from "swr";
import { Archive, Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, Notice, TableSkeleton } from "@/components/ui/feedback";
import { Menu } from "@/components/ui/menu";
import { useConfirm } from "@/components/ui/overlay";
import { TableWrap, THead, Td, Th, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useApi, useAsyncAction } from "@/lib/hooks";
import { useLookup } from "@/lib/lookups";
import { formatDate } from "@/utils/format";
import type { BackupInfo } from "@/services/BackupService";

const fmtTime = (iso: string) => `${formatDate(iso)} ${new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
const REASON: Record<string, string> = { manual: "Manual", "pre-restore": "Before restore", "pre-import": "Before import", "pre-delete-project": "Before project delete" };

export function BackupsPanel() {
  const toast = useToast();
  const confirm = useConfirm();
  const lookup = useLookup();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const { data, error, isLoading, reload } = useApi<BackupInfo[]>("/api/backups");
  const everything = () => globalMutate(() => true);

  const [backupNow, backingUp] = useAsyncAction(async () => {
    const b = await api.post<BackupInfo>("/api/backups");
    toast.success(`Backup ${b.name} created`);
    await reload();
  }, toast.error);

  const [restore, restoring] = useAsyncAction(async (b: BackupInfo) => {
    const ok = await confirm({
      title: `Restore backup ${b.name}?`, destructive: true, confirmLabel: "Replace current data",
      message: <>All current data will be <strong>replaced</strong> with this backup ({b.totalRows} records from {fmtTime(b.createdAt)}). Changes made since then will be lost. A safety backup of the current data is created first, so this can be undone.</>,
    });
    if (!ok) return;
    const r = await api.post<{ safetyBackup: string }>(`/api/backups/${b.name}/restore`);
    toast.success(`Restored. Previous data saved as ${r.safetyBackup}`);
    await everything(); lookup.reload();
  }, toast.error);

  const [remove] = useAsyncAction(async (b: BackupInfo) => {
    if (!(await confirm({ title: `Delete backup ${b.name}?`, message: "This backup will be permanently removed.", destructive: true, confirmLabel: "Delete" }))) return;
    await api.del(`/api/backups/${b.name}`);
    toast.success("Backup deleted");
    await reload();
  }, toast.error);

  const [doImport, importing] = useAsyncAction(async (file: File) => {
    let json: unknown;
    try { json = JSON.parse(await file.text()); } catch { throw new Error("That file isn't valid JSON."); }
    const j = json as { version?: unknown; collections?: Record<string, unknown> };
    if (!j || typeof j !== "object" || !j.collections || typeof j.collections !== "object" || j.version !== 1) throw new Error("This doesn't look like a TaskFlow export (missing version or collections).");
    const summary = Object.entries(j.collections).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${(v as unknown[]).length} ${k}`).join(", ");
    const ok = await confirm({
      title: "Import data and replace everything?", destructive: true, confirmLabel: "Import & replace",
      message: <>Current data will be replaced by <strong>{file.name}</strong> ({summary}). The file is validated first and a safety backup is made before anything changes.</>,
    });
    if (!ok) return;
    const r = await api.post<{ imported: Record<string, number>; safetyBackup: string }>("/api/import", json);
    const total = Object.values(r.imported).reduce((a, b) => a + b, 0);
    toast.success(`Imported ${total} records. Previous data saved as ${r.safetyBackup}`);
    await everything(); lookup.reload();
  }, toast.error);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) { setFileName(f.name); doImport(f); }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Export all data" description="Download every collection as one JSON file (includes password hashes, so keep it private)." />
          <a href="/api/export" download className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"><Download className="size-4" />Download export</a>
        </Card>
        <Card>
          <CardHeader title="Import data" description="Replace all data from a previous export. Validated before anything is replaced." />
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={pick} aria-label="Choose export file" />
          <Button variant="outline" loading={importing} icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>Choose export file…</Button>
          {fileName && <span className="ml-2 text-xs text-slate-500">{fileName}</span>}
        </Card>
      </div>
      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 p-4 pb-0">
          <CardHeader title="Backups" description="Timestamped snapshots in /backups. The latest 30 are kept." className="mb-3" />
          <Button size="sm" icon={<Archive className="size-4" />} loading={backingUp} onClick={() => backupNow()} className="mb-3">Backup now</Button>
        </div>
        {error ? <ErrorState error={error} onRetry={reload} /> : isLoading && !data ? <TableSkeleton cols={4} rows={3} /> : !data?.length ? (
          <EmptyState icon={<Archive className="size-5" />} title="No backups yet" description="Create one now; they're also made automatically before restores, imports and project deletions." />
        ) : (
          <TableWrap>
            <THead><tr><Th>Backup</Th><Th>Created</Th><Th>Reason</Th><Th className="text-right">Records</Th><Th className="w-10"><span className="sr-only">Actions</span></Th></tr></THead>
            <tbody>
              {data.map((b) => (
                <Tr key={b.name}>
                  <Td className="font-mono text-xs text-slate-800">{b.name}</Td><Td className="whitespace-nowrap">{fmtTime(b.createdAt)}</Td>
                  <Td>{REASON[b.reason] ?? b.reason}</Td><Td className="text-right tabular-nums">{b.totalRows}</Td>
                  <Td className="text-right"><Menu items={[
                    { label: "Restore…", icon: <RotateCcw className="size-4" />, onSelect: () => restore(b), disabled: restoring },
                    { label: "Delete", icon: <Trash2 className="size-4" />, onSelect: () => remove(b), danger: true },
                  ]} /></Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
      <Notice tone="info">Uploaded files (receipts, attachments) are stored separately in <code>data/uploads</code> and are <strong>not</strong> included in backups or exports.</Notice>
    </div>
  );
}
