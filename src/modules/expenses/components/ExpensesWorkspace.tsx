"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, FileText, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import type { Expense } from "@/schemas/entities";
import { EXPENSE_CATEGORIES, APPROVAL_STATUSES } from "@/schemas/entities";
import { Button } from "@/components/ui/Button";
import { Avatar, Badge, Card, StatCard, StatusBadge } from "@/components/ui/display";
import { Checkbox, Input, SearchInput, Select, enumOptions } from "@/components/ui/form";
import { EmptyState, ErrorState, Notice, TableSkeleton, CardsSkeleton } from "@/components/ui/feedback";
import { Menu } from "@/components/ui/menu";
import { useConfirm } from "@/components/ui/overlay";
import { Pagination, SortTh, TableWrap, THead, Td, Th, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api, qs } from "@/lib/api";
import { invalidate, useApi, useDebounced } from "@/lib/hooks";
import { useCan, useLookup, useMe } from "@/lib/lookups";
import { approvalTone } from "@/lib/status";
import { formatDate, formatMoney, label } from "@/utils/format";
import { ExpenseFormModal, EXPENSE_INVALIDATE } from "./ExpenseFormModal";

interface Summary { total: number; team: number; software: number; other: number; pending: number; count: number }
const PAGE_SIZE = 20;
const methodLabel = (m: string) => (m === "UPI" ? "UPI" : label(m));
const categoryLabel = (c: string) => (c === "API" ? "API" : label(c));
const FILTER_KEYS = ["q", "projectId", "category", "paidBy", "from", "to", "minAmount", "maxAmount", "approvalStatus", "deleted"] as const;
type Filters = Record<(typeof FILTER_KEYS)[number], string>;

export function ExpensesWorkspace(props: { projectId?: string }) {
  return <Suspense fallback={<CardsSkeleton count={5} />}><Inner {...props} /></Suspense>;
}

function Inner({ projectId }: { projectId?: string }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const { projects, userName, usersById, projectName } = useLookup();
  const canWrite = useCan("expense:write");
  const canApprove = useCan("expense:approve");
  const finance = useCan("finance:view");

  const [filters, setFilters] = useState<Filters>(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, k === "projectId" ? projectId ?? "" : sp.get(k) ?? ""])) as Filters);
  const [sort, setSort] = useState("date:desc");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const setF = (k: keyof Filters, v: string) => { setFilters((s) => ({ ...s, [k]: v })); setPage(1); };

  const dq = useDebounced(filters.q), dmin = useDebounced(filters.minAmount), dmax = useDebounced(filters.maxAmount);
  const query = { ...filters, projectId: projectId ?? filters.projectId, q: dq, minAmount: dmin, maxAmount: dmax, deleted: filters.deleted === "true" ? "true" : "", page, pageSize: PAGE_SIZE, sort };
  const { data, meta, error, isLoading, reload } = useApi<Expense[]>(`/api/expenses${qs(query)}`);
  const summary = meta?.summary as Summary | undefined;

  // mirror filters to the URL (standalone page only; project tabs own their own URL)
  useEffect(() => {
    if (projectId) return;
    const next = new URLSearchParams(sp.toString());
    for (const k of FILTER_KEYS) { if (filters[k]) next.set(k, filters[k]); else next.delete(k); }
    const s = next.toString();
    if (s !== sp.toString()) router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // ?expense=ID opens that expense
  const focusId = sp.get("expense");
  const focused = useApi<Expense>(focusId ? `/api/expenses/${focusId}` : null);
  useEffect(() => {
    if (focusId && focused.data && focused.data.id === focusId) { setEditing(focused.data); setFormOpen(true); }
  }, [focusId, focused.data]);
  const closeForm = () => {
    setFormOpen(false); setEditing(null);
    if (focusId) { const n = new URLSearchParams(sp.toString()); n.delete("expense"); router.replace(n.toString() ? `${pathname}?${n}` : pathname, { scroll: false }); }
  };

  const canModify = (e: Expense) => canWrite && !e.isDeleted && (canApprove || (e.createdBy === me.id && e.approvalStatus !== "APPROVED"));
  const refresh = () => invalidate(...EXPENSE_INVALIDATE);

  async function run(id: string, fn: () => Promise<unknown>, ok: string) {
    setBusyId(id);
    try { await fn(); toast.success(ok); await refresh(); } catch (e) { toast.error(e); } finally { setBusyId(null); }
  }
  const decide = (e: Expense, decision: "APPROVED" | "REJECTED") =>
    run(e.id, () => api.post(`/api/expenses/${e.id}/approve`, { decision }), decision === "APPROVED" ? "Expense approved." : "Expense rejected.");
  async function remove(e: Expense) {
    if (await confirm({ title: "Delete expense?", message: `“${e.description}” (${formatMoney(e.amount, e.currency)}) will be removed from project costs. You can restore it later.`, confirmLabel: "Delete", destructive: true }))
      run(e.id, () => api.del(`/api/expenses/${e.id}`), "Expense deleted.");
  }
  const restore = (e: Expense) => run(e.id, () => api.post(`/api/expenses/${e.id}/restore`), "Expense restored.");

  const rows = data ?? [];
  const showDeleted = filters.deleted === "true";
  const activeFilterCount = FILTER_KEYS.filter((k) => k !== "projectId" || !projectId).filter((k) => filters[k]).length;
  const money = (e: Expense) => formatMoney(e.amount, e.currency);

  const actions = (e: Expense, compact = false) => (
    <div className="flex items-center justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
      {canApprove && e.approvalStatus === "PENDING" && !e.isDeleted && (
        <>
          <Button size="xs" variant="outline" aria-label="Approve" title="Approve" icon={<Check className="size-3.5 text-emerald-600" />} disabled={busyId === e.id} onClick={() => decide(e, "APPROVED")}>{compact ? null : "Approve"}</Button>
          <Button size="xs" variant="outline" aria-label="Reject" title="Reject" icon={<X className="size-3.5 text-rose-600" />} disabled={busyId === e.id} onClick={() => decide(e, "REJECTED")}>{compact ? null : "Reject"}</Button>
        </>
      )}
      <Menu items={[
        { label: "Edit", icon: <Pencil className="size-4" />, onSelect: () => { setEditing(e); setFormOpen(true); }, hidden: !canModify(e) },
        { label: "Delete", icon: <Trash2 className="size-4" />, danger: true, onSelect: () => remove(e), hidden: !canModify(e) },
        { label: "Restore", icon: <RotateCcw className="size-4" />, onSelect: () => restore(e), hidden: !(e.isDeleted && canApprove) },
        { label: e.approvalStatus === "REJECTED" ? "Approve instead" : "Reject", icon: e.approvalStatus === "REJECTED" ? <Check className="size-4" /> : <X className="size-4" />, onSelect: () => decide(e, e.approvalStatus === "REJECTED" ? "APPROVED" : "REJECTED"), hidden: !(canApprove && !e.isDeleted && e.approvalStatus === "APPROVED") && !(canApprove && !e.isDeleted && e.approvalStatus === "REJECTED") },
      ]} />
    </div>
  );
  const receipt = (e: Expense, quiet = false) => e.attachmentId ? <a href={`/api/attachments/${e.attachmentId}`} onClick={(ev) => ev.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"><FileText className="size-3.5" />Receipt</a> : quiet ? null : <span className="text-xs text-slate-300">—</span>;
  const payer = (e: Expense, short = false) => <span className="inline-flex items-center gap-1.5"><Avatar name={userName(e.paidBy)} src={usersById.get(e.paidBy)?.avatar} size={20} /><span className="truncate">{short ? userName(e.paidBy).split(" ")[0] : userName(e.paidBy)}</span></span>;

  const projectOptions = useMemo(() => projects.filter((p) => !p.isDeleted), [projects]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total expenses" value={summary ? formatMoney(summary.total) : "—"} hint="Approved only" />
        <StatCard label="Team expenses" value={summary ? formatMoney(summary.team) : "—"} />
        <StatCard label="Software" value={summary ? formatMoney(summary.software) : "—"} />
        <StatCard label="Other" value={summary ? formatMoney(summary.other) : "—"} />
        <StatCard label="Pending approval" value={summary ? formatMoney(summary.pending) : "—"} tone={summary && summary.pending > 0 ? "warn" : undefined} hint="Not yet counted" />
      </div>

      <Card padded={false}>
        <div className="space-y-3 border-b border-slate-100 p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput className="flex-1" placeholder="Search description or notes…" value={filters.q} onChange={(e) => setF("q", e.target.value)} aria-label="Search expenses" />
            {canWrite && <Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>Add expense</Button>}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {!projectId && <Select aria-label="Project" value={filters.projectId} onChange={(e) => setF("projectId", e.target.value)}><option value="">All projects</option>{projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}
            <Select aria-label="Category" value={filters.category} onChange={(e) => setF("category", e.target.value)}><option value="">All categories</option>{enumOptions(EXPENSE_CATEGORIES, categoryLabel)}</Select>
            {finance && <UserSelectFilter value={filters.paidBy} onChange={(v) => setF("paidBy", v)} />}
            <Select aria-label="Approval status" value={filters.approvalStatus} onChange={(e) => setF("approvalStatus", e.target.value)}><option value="">Any status</option>{enumOptions(APPROVAL_STATUSES, label)}</Select>
            <Input aria-label="From date" type="date" value={filters.from} onChange={(e) => setF("from", e.target.value)} title="From date" />
            <Input aria-label="To date" type="date" value={filters.to} onChange={(e) => setF("to", e.target.value)} title="To date" />
            <Input aria-label="Minimum amount" type="number" min="0" placeholder="Min ₹" value={filters.minAmount} onChange={(e) => setF("minAmount", e.target.value)} />
            <Input aria-label="Maximum amount" type="number" min="0" placeholder="Max ₹" value={filters.maxAmount} onChange={(e) => setF("maxAmount", e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Checkbox label="Show deleted" checked={showDeleted} onChange={(e) => setF("deleted", e.target.checked ? "true" : "")} />
            {activeFilterCount > 0 && <button className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => { setFilters(Object.fromEntries(FILTER_KEYS.map((k) => [k, k === "projectId" ? projectId ?? "" : ""])) as Filters); setPage(1); }}>Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}</button>}
          </div>
          {!finance && <Notice tone="info">You can see expenses you submitted or paid. Expenses count toward project cost once approved.</Notice>}
        </div>

        {error ? <ErrorState error={error} onRetry={reload} /> : isLoading && !data ? <TableSkeleton cols={6} /> : !rows.length ? (
          <EmptyState title={showDeleted ? "No deleted expenses" : activeFilterCount ? "No expenses match these filters" : "No expenses yet"}
            description={activeFilterCount ? "Try clearing some filters." : canWrite ? "Add the first expense to start tracking project costs." : undefined}
            action={canWrite && !activeFilterCount && !showDeleted ? <Button icon={<Plus className="size-4" />} onClick={() => setFormOpen(true)}>Add expense</Button> : undefined} />
        ) : (
          <>
            <div className="hidden md:block">
              <TableWrap>
                <THead><tr>
                  <SortTh label="Date" field="date" sort={sort} onSort={setSort} />
                  <Th>Description</Th>
                  {!projectId && <Th>Project</Th>}
                  <SortTh label="Category" field="category" sort={sort} onSort={setSort} />
                  <Th>Paid by</Th>
                  <SortTh label="Amount" field="amount" sort={sort} onSort={setSort} className="text-right" />
                  <Th>Status</Th><Th className="w-px" />
                </tr></THead>
                <tbody>
                  {rows.map((e) => (
                    <Tr key={e.id} className={e.isDeleted ? "opacity-60" : focusId === e.id ? "bg-indigo-50/60" : ""} onClick={canModify(e) ? () => { setEditing(e); setFormOpen(true); } : undefined}>
                      <Td className="whitespace-nowrap text-slate-500">{formatDate(e.date)}</Td>
                      <Td className="max-w-56"><div className="truncate font-medium text-slate-900">{e.description}</div><div className="flex items-center gap-2 text-xs text-slate-400"><span>{e.id} · {methodLabel(e.paymentMethod)}</span>{receipt(e, true)}</div></Td>
                      {!projectId && <Td className="max-w-36 truncate" title={projectName(e.projectId)}>{projectName(e.projectId)}</Td>}
                      <Td><Badge tone="slate">{categoryLabel(e.category)}</Badge></Td>
                      <Td>{payer(e, true)}</Td>
                      <Td className="whitespace-nowrap text-right font-medium tabular-nums text-slate-900">{money(e)}</Td>
                      <Td>{e.isDeleted ? <Badge tone="zinc">Deleted</Badge> : <StatusBadge value={e.approvalStatus} tones={approvalTone} />}</Td>
                      <Td>{actions(e, true)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((e) => (
                <li key={e.id} className={`space-y-2 p-3 ${e.isDeleted ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="truncate font-medium text-slate-900">{e.description}</p>{!projectId && <p className="truncate text-xs text-slate-500">{projectName(e.projectId)}</p>}</div>
                    <p className="shrink-0 font-semibold tabular-nums text-slate-900">{money(e)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge tone="slate">{categoryLabel(e.category)}</Badge>
                    {e.isDeleted ? <Badge tone="zinc">Deleted</Badge> : <StatusBadge value={e.approvalStatus} tones={approvalTone} />}
                    <span>{formatDate(e.date)}</span><span>{methodLabel(e.paymentMethod)}</span>{receipt(e)}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-600">{payer(e)}{actions(e)}</div>
                </li>
              ))}
            </ul>
            <Pagination page={meta?.page ?? 1} totalPages={meta?.totalPages ?? 1} total={meta?.total ?? rows.length} pageSize={PAGE_SIZE} onPage={setPage} />
          </>
        )}
      </Card>

      <ExpenseFormModal open={formOpen} onClose={closeForm} expense={editing} projectId={projectId} />
    </div>
  );
}

/** Compact "paid by" filter (reuses the people list from lookups). */
function UserSelectFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { users } = useLookup();
  return (
    <Select aria-label="Team member" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All members</option>
      {users.filter((u) => !u.isDeleted).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </Select>
  );
}
