"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { KeyRound, Pencil, Plus, Power, RotateCcw, Trash2, Users } from "lucide-react";
import type { PublicUser } from "@/schemas/entities";
import { ROLES } from "@/schemas/entities";
import { Button } from "@/components/ui/Button";
import { Avatar, Badge, Card, CardHeader, PageHeader, ProgressBar } from "@/components/ui/display";
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/ui/feedback";
import { Checkbox, SearchInput, Select, enumOptions } from "@/components/ui/form";
import { Menu } from "@/components/ui/menu";
import { useConfirm } from "@/components/ui/overlay";
import { Pagination, TableWrap, THead, Td, Th, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { invalidate, useApi, useAsyncAction, useDebounced } from "@/lib/hooks";
import { useCan, useLookup, useMe } from "@/lib/lookups";
import { formatMoney, label } from "@/utils/format";
import { ResetPasswordModal, UserFormModal } from "./UserModals";
import { UserDrawer } from "./UserDrawer";

interface Load { userId: string; name: string; role: string; avatar: string | null; openTasks: number; overdueTasks: number; remainingHours: number; utilization: number }
const PAGE_SIZE = 20;

function loadTone(p: number) { return p > 100 ? "rose" : p >= 70 ? "amber" : "emerald"; }

function Workload() {
  const { data, error, isLoading, reload } = useApi<Load[]>("/api/team/workload");
  return (
    <Card>
      <CardHeader title="Team workload" description="Remaining estimated hours on open tasks vs. two weeks of capacity (80h)" />
      {error ? <ErrorState error={error} onRetry={reload} className="py-6" /> : isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
      ) : !data?.length ? <EmptyState title="No active team members" className="py-6" /> : (
        <ul className="grid gap-x-8 gap-y-3 lg:grid-cols-2">
          {data.map((w) => (
            <li key={w.userId} className="flex items-center gap-3">
              <Avatar name={w.name} src={w.avatar} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-800">{w.name} <span className="text-xs font-normal text-slate-400">· {label(w.role)}</span></span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">{w.utilization}%</span>
                </div>
                <ProgressBar value={w.utilization} tone={loadTone(w.utilization)} label={`${w.name} workload`} className="my-1" />
                <p className="text-xs text-slate-500">{w.openTasks} open · <span className={w.overdueTasks ? "font-medium text-rose-600" : ""}>{w.overdueTasks} overdue</span> · {w.remainingHours}h left</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function TeamPage() {
  const me = useMe();
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const lookup = useLookup();
  const canManage = useCan("user:manage");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [deleted, setDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState<PublicUser | null>(null);
  const dq = useDebounced(q);
  const url = `/api/users?page=${page}&pageSize=${PAGE_SIZE}&sort=name:asc&q=${encodeURIComponent(dq)}${role ? `&role=${role}` : ""}${status ? `&active=${status === "active"}` : ""}${deleted ? "&deleted=true" : ""}`;
  const { data, meta, error, isLoading, reload } = useApi<PublicUser[]>(url);
  const rows = (deleted ? data : data?.filter((u) => !u.isDeleted)) ?? [];
  const drawerId = sp.get("user");
  const closeDrawer = () => router.replace("/team", { scroll: false });
  const showRates = (u: PublicUser) => u.hourlyRate > 0 || u.dailyRate > 0;

  const refresh = async () => { await invalidate("/api/users", "/api/team"); lookup.reload(); };
  const [act] = useAsyncAction(async (fn: () => Promise<unknown>, ok: string) => { await fn(); toast.success(ok); await refresh(); }, toast.error);

  const toggleActive = (u: PublicUser) => act(() => api.put(`/api/users/${u.id}`, { active: !u.active }), u.active ? `${u.name} disabled` : `${u.name} enabled`);
  const remove = async (u: PublicUser) => {
    if (await confirm({ title: `Remove ${u.name}?`, message: "They lose access immediately. Their tasks and history stay intact, and you can restore them later.", confirmLabel: "Remove", destructive: true }))
      act(() => api.del(`/api/users/${u.id}`), `${u.name} removed`);
  };
  const restore = (u: PublicUser) => act(() => api.post(`/api/users/${u.id}/restore`), `${u.name} restored`);

  const menuFor = (u: PublicUser) => {
    const self = u.id === me.id;
    return u.isDeleted
      ? [{ label: "Restore", icon: <RotateCcw className="size-4" />, onSelect: () => restore(u) }]
      : [
        { label: "Edit", icon: <Pencil className="size-4" />, onSelect: () => setEditing(u) },
        { label: u.active ? "Disable" : "Enable", icon: <Power className="size-4" />, onSelect: () => toggleActive(u), hidden: self },
        { label: "Reset access", icon: <KeyRound className="size-4" />, onSelect: () => setResetFor(u), hidden: self },
        { label: "Remove", icon: <Trash2 className="size-4" />, onSelect: () => remove(u), danger: true, hidden: self },
      ];
  };
  const statusBadge = (u: PublicUser) => <Badge tone={u.isDeleted ? "rose" : u.active ? "emerald" : "zinc"} dot>{u.isDeleted ? "Removed" : u.active ? "Active" : "Inactive"}</Badge>;
  const open = (u: PublicUser) => router.push(`/team?user=${u.id}`, { scroll: false });

  return (
    <>
      <PageHeader title="Team" description="People, roles and who is carrying what."
        actions={canManage && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Add member</Button>} />
      <div className="space-y-5">
        <Workload />
        <Card padded={false}>
          <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row sm:flex-wrap sm:items-center">
            <SearchInput className="sm:w-64" placeholder="Search name or email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search team" />
            <Select aria-label="Filter by role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="sm:w-44"><option value="">All roles</option>{enumOptions(ROLES, label)}</Select>
            <Select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-36"><option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option></Select>
            {canManage && <Checkbox label="Show removed" checked={deleted} onChange={(e) => { setDeleted(e.target.checked); setPage(1); }} />}
          </div>
          {error ? <ErrorState error={error} onRetry={reload} /> : isLoading && !data ? <TableSkeleton cols={5} /> : !rows.length ? (
            <EmptyState icon={<Users className="size-5" />} title={deleted ? "No removed members" : "No team members found"} description={q || role || status ? "Try adjusting your filters." : undefined}
              action={canManage && !deleted && !q && !role && !status ? <Button size="sm" onClick={() => setCreating(true)}>Add member</Button> : undefined} />
          ) : (
            <>
              {/* mobile cards */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {rows.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 p-3" onClick={() => open(u)}>
                    <Avatar name={u.name} src={u.avatar} size={36} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-900">{u.name}{u.id === me.id && <span className="text-xs text-slate-400"> (you)</span>}</p>
                      <p className="truncate text-xs text-slate-500">{u.email}</p>
                      <div className="mt-1 flex flex-wrap gap-1"><Badge tone="indigo">{label(u.role)}</Badge>{statusBadge(u)}</div></div>
                    {canManage && <Menu items={menuFor(u)} />}
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <TableWrap>
                  <THead><tr><Th>Member</Th><Th>Role</Th><Th>Status</Th><Th className="text-right">Rates</Th>{canManage && <Th className="w-10"><span className="sr-only">Actions</span></Th>}</tr></THead>
                  <tbody>
                    {rows.map((u) => (
                      <Tr key={u.id} onClick={() => open(u)}>
                        <Td><div className="flex items-center gap-3"><Avatar name={u.name} src={u.avatar} size={32} /><div className="min-w-0"><p className="truncate font-medium text-slate-900">{u.name}{u.id === me.id && <span className="text-xs font-normal text-slate-400"> (you)</span>}</p><p className="truncate text-xs text-slate-500">{u.email}</p></div></div></Td>
                        <Td><Badge tone="indigo">{label(u.role)}</Badge></Td>
                        <Td>{statusBadge(u)}</Td>
                        <Td className="text-right tabular-nums text-xs">{showRates(u) ? <>{formatMoney(u.hourlyRate)}/h<br /><span className="text-slate-400">{formatMoney(u.dailyRate)}/day</span></> : <span className="text-slate-300">—</span>}</Td>
                        {canManage && <Td className="text-right"><Menu items={menuFor(u)} /></Td>}
                      </Tr>
                    ))}
                  </tbody>
                </TableWrap>
              </div>
              {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPage={setPage} />}
            </>
          )}
        </Card>
      </div>
      <UserFormModal open={creating || !!editing} user={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} />
      <UserDrawer userId={drawerId} onClose={closeDrawer} />
    </>
  );
}
