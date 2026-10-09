"use client";
import Link from "next/link";
import { useState } from "react";
import { Archive, BriefcaseBusiness, Pencil, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader, ProgressBar, StatusBadge, AvatarStack } from "@/components/ui/display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Checkbox, SearchInput, Select, enumOptions } from "@/components/ui/form";
import { Menu } from "@/components/ui/menu";
import { useConfirm } from "@/components/ui/overlay";
import { Pagination, SortTh, TableWrap, THead, Td, Th, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api, qs, type PageMeta } from "@/lib/api";
import { invalidate, useApi, useDebounced } from "@/lib/hooks";
import { useCan, useLookup } from "@/lib/lookups";
import { HEALTH_LABEL, healthTone, priorityTone, projectStatusTone } from "@/lib/status";
import { PRIORITIES } from "@/schemas/common";
import { PROJECT_STATUSES } from "@/schemas/entities";
import { formatDate, formatMoney, label } from "@/utils/format";
import { ProjectFormModal } from "./ProjectFormModal";
import type { ProjectView } from "./types";

const PAGE_SIZE = 15;

export function ProjectsList() {
  const { clients, users, userName, clientName, usersById, reload } = useLookup();
  const canWrite = useCan("project:write");
  const canDelete = useCan("project:delete");
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [clientId, setClientId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [archived, setArchived] = useState(false);
  const [sort, setSort] = useState("updatedAt:desc");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ProjectView | null>(null);
  const [creating, setCreating] = useState(false);
  const dq = useDebounced(q);

  const url = `/api/projects${qs({ q: dq, status, priority, clientId, memberId, deleted: archived, sort, page, pageSize: PAGE_SIZE })}`;
  const { data, meta, error, isLoading, reload: refetch } = useApi<ProjectView[]>(url);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  async function after() { await Promise.all([invalidate("/api/projects", "/api/dashboard"), reload()]); }
  async function archive(p: ProjectView) {
    if (!(await confirm({ title: `Archive ${p.name}?`, message: "The project and its tasks, expenses and payments are hidden. A safety backup is taken first, and you can restore it later.", confirmLabel: "Archive", destructive: true }))) return;
    try { await api.del(`/api/projects/${p.id}`); toast.success("Project archived"); await after(); } catch (e) { toast.error(e); }
  }
  async function restore(p: ProjectView) {
    try { await api.post(`/api/projects/${p.id}/restore`); toast.success("Project restored"); await after(); } catch (e) { toast.error(e); }
  }
  const actions = (p: ProjectView) => (
    <Menu items={[
      { label: "Edit", icon: <Pencil className="size-4" />, onSelect: () => setEditing(p), hidden: !canWrite || p.isDeleted },
      { label: "Archive", icon: <Archive className="size-4" />, danger: true, onSelect: () => archive(p), hidden: !canDelete || p.isDeleted },
      { label: "Restore", icon: <RotateCcw className="size-4" />, onSelect: () => restore(p), hidden: !canDelete || !p.isDeleted },
    ]} />
  );
  const team = (p: ProjectView) => p.memberIds.map((id) => ({ id, name: userName(id), avatar: usersById.get(id)?.avatar }));
  const hasFilters = !!(dq || status || priority || clientId || memberId);
  const showValue = !!data?.some((p) => p.financials);

  return (
    <>
      <PageHeader title="Projects" description="Everything you are delivering, with progress and health at a glance."
        actions={canWrite && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New project</Button>} />
      <Card padded={false}>
        <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-3 lg:grid-cols-[1fr_repeat(4,10rem)_auto] lg:items-end">
          <SearchInput className="col-span-2 lg:col-span-1" placeholder="Search projects…" aria-label="Search projects" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <Select aria-label="Status" value={status} onChange={(e) => reset(setStatus)(e.target.value)}><option value="">All statuses</option>{enumOptions(PROJECT_STATUSES, label)}</Select>
          <Select aria-label="Priority" value={priority} onChange={(e) => reset(setPriority)(e.target.value)}><option value="">All priorities</option>{enumOptions(PRIORITIES, label)}</Select>
          <Select aria-label="Client" value={clientId} onChange={(e) => reset(setClientId)(e.target.value)}><option value="">All clients</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}</Select>
          <Select aria-label="Team member" value={memberId} onChange={(e) => reset(setMemberId)(e.target.value)}><option value="">Any member</option>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
          <Checkbox className="col-span-2 lg:col-span-1" label="Show archived" checked={archived} onChange={(e) => reset(setArchived)(e.target.checked)} />
        </div>

        {isLoading && !data ? <TableSkeleton cols={6} /> : error ? <ErrorState error={error} onRetry={refetch} /> : !data?.length ? (
          <EmptyState icon={<BriefcaseBusiness className="size-5" />} title={archived ? "No archived projects" : hasFilters ? "No projects match your filters" : "No projects yet"}
            description={hasFilters ? "Try clearing a filter or searching for something else." : "Create your first project to start planning tasks, time and budgets."}
            action={canWrite && !hasFilters && !archived ? <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New project</Button> : undefined} />
        ) : (
          <>
            {/* desktop table */}
            <div className="hidden md:block">
              <TableWrap>
                <THead><tr>
                  <SortTh label="Project" field="name" sort={sort} onSort={setSort} />
                  <SortTh label="Status" field="status" sort={sort} onSort={setSort} />
                  <SortTh label="Priority" field="priority" sort={sort} onSort={setSort} />
                  <SortTh label="Progress" field="progress" sort={sort} onSort={setSort} className="w-44" />
                  <Th>Team</Th>
                  <SortTh label="Due" field="expectedEndDate" sort={sort} onSort={setSort} />
                  {showValue && <SortTh label="Contract" field="contractValue" sort={sort} onSort={setSort} className="text-right" />}
                  <Th className="w-10"><span className="sr-only">Actions</span></Th>
                </tr></THead>
                <tbody>
                  {data.map((p) => (
                    <Tr key={p.id} className={p.isDeleted ? "opacity-60" : undefined}>
                      <Td>
                        <Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-indigo-600">{p.name}</Link>
                        <div className="text-xs text-slate-500">{p.id} · {clientName(p.clientId)}</div>
                      </Td>
                      <Td><div className="flex flex-col items-start gap-1"><StatusBadge value={p.status} tones={projectStatusTone} />{p.status === "ACTIVE" && p.health !== "ON_TRACK" && <StatusBadge value={p.health} tones={healthTone} text={HEALTH_LABEL[p.health]} />}</div></Td>
                      <Td><StatusBadge value={p.priority} tones={priorityTone} /></Td>
                      <Td><div className="flex items-center gap-2"><ProgressBar value={p.progress} tone={p.progress === 100 ? "emerald" : "indigo"} className="flex-1" label={`${p.name} progress`} /><span className="w-9 text-right text-xs tabular-nums text-slate-500">{p.progress}%</span></div><div className="mt-0.5 text-xs text-slate-400">{p.taskStats.done}/{p.taskStats.total} tasks{p.taskStats.overdue ? <span className="text-rose-500"> · {p.taskStats.overdue} overdue</span> : null}</div></Td>
                      <Td><AvatarStack people={team(p)} max={4} /></Td>
                      <Td className="whitespace-nowrap">{formatDate(p.expectedEndDate)}</Td>
                      {showValue && <Td className="text-right tabular-nums">{p.financials ? formatMoney(p.contractValue) : "—"}</Td>}
                      <Td>{actions(p)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>
            {/* mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {data.map((p) => (
                <li key={p.id} className={`space-y-2 p-4 ${p.isDeleted ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><Link href={`/projects/${p.id}`} className="block truncate font-medium text-slate-900">{p.name}</Link><div className="truncate text-xs text-slate-500">{p.id} · {clientName(p.clientId)}</div></div>
                    {actions(p)}
                  </div>
                  <div className="flex flex-wrap gap-1.5"><StatusBadge value={p.status} tones={projectStatusTone} /><StatusBadge value={p.priority} tones={priorityTone} />{p.status === "ACTIVE" && p.health !== "ON_TRACK" && <StatusBadge value={p.health} tones={healthTone} text={HEALTH_LABEL[p.health]} />}</div>
                  <div className="flex items-center gap-2"><ProgressBar value={p.progress} className="flex-1" label="Progress" /><span className="text-xs tabular-nums text-slate-500">{p.progress}%</span></div>
                  <div className="flex items-center justify-between text-xs text-slate-500"><AvatarStack people={team(p)} max={5} size={22} /><span>Due {formatDate(p.expectedEndDate)}</span></div>
                </li>
              ))}
            </ul>
            <Pagination page={(meta as PageMeta).page} totalPages={(meta as PageMeta).totalPages} total={(meta as PageMeta).total} pageSize={PAGE_SIZE} onPage={setPage} />
          </>
        )}
      </Card>
      <ProjectFormModal open={creating || !!editing} project={editing} onClose={() => { setCreating(false); setEditing(null); }} />
    </>
  );
}
