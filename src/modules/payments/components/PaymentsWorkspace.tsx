"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, Lock, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { Payment } from "@/schemas/entities";
import { PAYMENT_STATUSES } from "@/schemas/entities";
import { Button } from "@/components/ui/Button";
import { Badge, Card, StatCard, StatusBadge } from "@/components/ui/display";
import { Checkbox, SearchInput, Select, enumOptions } from "@/components/ui/form";
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Menu } from "@/components/ui/menu";
import { useConfirm } from "@/components/ui/overlay";
import { Pagination, TableWrap, THead, Td, Th, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api, qs } from "@/lib/api";
import { invalidate, useApi, useDebounced } from "@/lib/hooks";
import { useCan, useLookup } from "@/lib/lookups";
import { paymentStatusTone } from "@/lib/status";
import { formatDate, formatMoney, label } from "@/utils/format";
import { PaymentFormModal, PAYMENT_INVALIDATE } from "./PaymentFormModal";
import type { PaymentView } from "./types";

const PAGE_SIZE = 20;
const methodLabel = (m: string) => (m === "UPI" ? "UPI" : label(m));

export function PaymentsWorkspace(props: { projectId?: string }) {
  return <Suspense fallback={<CardsSkeleton count={4} />}><Gate {...props} /></Suspense>;
}

function Gate(props: { projectId?: string }) {
  if (!useCan("finance:view")) {
    return <Card><EmptyState icon={<Lock className="size-5" />} title="No access to payments" description="Payments are visible to admins, project managers and finance. Ask an admin if you need access." /></Card>;
  }
  return <Inner {...props} />;
}

function Inner({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const { projects, clients, projectName, clientName } = useLookup();
  const canWrite = useCan("payment:write");

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [pid, setPid] = useState(projectId ?? sp.get("projectId") ?? "");
  const [clientId, setClientId] = useState(sp.get("clientId") ?? "");
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [deleted, setDeleted] = useState(sp.get("deleted") === "true");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const dq = useDebounced(q);
  const filterQs = { q: dq, projectId: projectId ?? pid, clientId, status, deleted: deleted ? "true" : "" };

  // summary is computed from all matching rows; table pages from the same endpoint
  const all = useApi<PaymentView[]>(`/api/payments${qs({ ...filterQs, pageSize: 500 })}`);
  const rows = all.data ?? [];
  const pageRows = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [rows, page]);
  const live = rows.filter((p) => !p.isDeleted && p.status !== "CANCELLED");
  const sum = (f: (p: PaymentView) => number) => live.reduce((s, p) => s + f(p), 0);
  const invoiced = sum((p) => p.amount), outstanding = sum((p) => p.outstanding), received = invoiced - outstanding;
  const overdue = live.filter((p) => p.effectiveStatus === "OVERDUE");

  useEffect(() => {
    if (projectId) return;
    const n = new URLSearchParams(sp.toString());
    const put = (k: string, v: string) => (v ? n.set(k, v) : n.delete(k));
    put("q", q); put("projectId", pid); put("clientId", clientId); put("status", status); put("deleted", deleted ? "true" : "");
    if (n.toString() !== sp.toString()) router.replace(n.toString() ? `${pathname}?${n}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pid, clientId, status, deleted]);

  const focusId = sp.get("payment");
  const focused = useApi<PaymentView>(focusId ? `/api/payments/${focusId}` : null);
  useEffect(() => { if (focusId && focused.data?.id === focusId && canWrite) { setEditing(focused.data); setFormOpen(true); } }, [focusId, focused.data, canWrite]);
  const closeForm = () => {
    setFormOpen(false); setEditing(null);
    if (focusId) { const n = new URLSearchParams(sp.toString()); n.delete("payment"); router.replace(n.toString() ? `${pathname}?${n}` : pathname, { scroll: false }); }
  };

  async function run(id: string, fn: () => Promise<unknown>, ok: string) {
    setBusyId(id);
    try { await fn(); toast.success(ok); await invalidate(...PAYMENT_INVALIDATE); } catch (e) { toast.error(e); } finally { setBusyId(null); }
  }
  async function remove(p: Payment) {
    if (await confirm({ title: "Delete payment?", message: `Invoice ${p.invoiceNumber} will no longer count toward received amounts. You can restore it later.`, confirmLabel: "Delete", destructive: true }))
      run(p.id, () => api.del(`/api/payments/${p.id}`), "Payment deleted.");
  }
  const markPaid = (p: Payment) => run(p.id, () => api.put(`/api/payments/${p.id}`, { status: "PAID" }), "Marked as paid.");
  const restore = (p: Payment) => run(p.id, () => api.post(`/api/payments/${p.id}/restore`), "Payment restored.");
  const edit = (p: Payment) => { setEditing(p); setFormOpen(true); };

  const filterCount = [q, !projectId && pid, clientId, status, deleted].filter(Boolean).length;
  const actions = (p: PaymentView, compact = false) => canWrite ? (
    <div className="flex items-center justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
      {!p.isDeleted && !["PAID", "CANCELLED"].includes(p.status) && <Button size="xs" variant="outline" icon={<BadgeCheck className="size-3.5 text-emerald-600" />} disabled={busyId === p.id} aria-label="Mark as paid" title="Mark as paid" onClick={() => markPaid(p)}>{compact ? null : "Mark paid"}</Button>}
      <Menu items={[
        { label: "Edit", icon: <Pencil className="size-4" />, onSelect: () => edit(p), hidden: p.isDeleted },
        { label: "Delete", icon: <Trash2 className="size-4" />, danger: true, onSelect: () => remove(p), hidden: p.isDeleted },
        { label: "Restore", icon: <RotateCcw className="size-4" />, onSelect: () => restore(p), hidden: !p.isDeleted },
      ]} />
    </div>
  ) : null;
  const badge = (p: PaymentView) => p.isDeleted ? <Badge tone="zinc">Deleted</Badge> : <StatusBadge value={p.effectiveStatus} tones={paymentStatusTone} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Invoiced" value={formatMoney(invoiced)} hint={`${live.length} invoice${live.length === 1 ? "" : "s"}`} />
        <StatCard label="Received" value={formatMoney(received)} tone="good" />
        <StatCard label="Outstanding" value={formatMoney(outstanding)} tone={outstanding > 0 ? "warn" : undefined} />
        <StatCard label="Overdue" value={overdue.length} tone={overdue.length ? "bad" : undefined} hint={overdue.length ? formatMoney(overdue.reduce((s, p) => s + p.outstanding, 0)) + " due" : "Nothing overdue"} />
      </div>

      <Card padded={false}>
        <div className="space-y-3 border-b border-slate-100 p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput className="flex-1" placeholder="Search invoice number or notes…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search payments" />
            {canWrite && <Button icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>Add payment</Button>}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {!projectId && <Select aria-label="Project" value={pid} onChange={(e) => { setPid(e.target.value); setPage(1); }}><option value="">All projects</option>{projects.filter((p) => !p.isDeleted).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}
            <Select aria-label="Client" value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(1); }}><option value="">All clients</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}</Select>
            <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Any status</option>{enumOptions(PAYMENT_STATUSES, label)}</Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Checkbox label="Show deleted" checked={deleted} onChange={(e) => { setDeleted(e.target.checked); setPage(1); }} />
            {filterCount > 0 && <button className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => { setQ(""); setPid(projectId ?? ""); setClientId(""); setStatus(""); setDeleted(false); setPage(1); }}>Clear filters</button>}
          </div>
        </div>

        {all.error ? <ErrorState error={all.error} onRetry={all.reload} /> : all.isLoading && !all.data ? <TableSkeleton cols={7} /> : !rows.length ? (
          <EmptyState title={deleted ? "No deleted payments" : filterCount ? "No payments match these filters" : "No payments yet"}
            description={filterCount ? "Try clearing some filters." : canWrite ? "Add an invoice to start tracking what clients owe." : undefined}
            action={canWrite && !filterCount ? <Button icon={<Plus className="size-4" />} onClick={() => setFormOpen(true)}>Add payment</Button> : undefined} />
        ) : (
          <>
            <div className="hidden md:block">
              <TableWrap>
                <THead><tr><Th>Invoice</Th>{!projectId && <Th>Project</Th>}<Th>Client</Th><Th className="text-right">Amount</Th><Th className="text-right">Received</Th><Th className="text-right">Outstanding</Th><Th>Due / paid</Th><Th>Status</Th><Th className="w-px" /></tr></THead>
                <tbody>
                  {pageRows.map((p) => (
                    <Tr key={p.id} className={p.isDeleted ? "opacity-60" : focusId === p.id ? "bg-indigo-50/60" : ""} onClick={canWrite && !p.isDeleted ? () => edit(p) : undefined}>
                      <Td className="whitespace-nowrap"><div className="font-medium text-slate-900">{p.invoiceNumber}</div><div className="text-xs text-slate-400">{p.id}{p.paymentMethod ? ` · ${methodLabel(p.paymentMethod)}` : ""}</div></Td>
                      {!projectId && <Td className="max-w-36 truncate" title={projectName(p.projectId)}>{projectName(p.projectId)}</Td>}
                      <Td className="max-w-32 truncate" title={clientName(p.clientId)}>{clientName(p.clientId)}</Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">{formatMoney(p.amount, p.currency)}</Td>
                      <Td className="whitespace-nowrap text-right tabular-nums text-emerald-700">{formatMoney(p.status === "PAID" ? p.amount : p.receivedAmount, p.currency)}</Td>
                      <Td className={`whitespace-nowrap text-right tabular-nums ${p.outstanding > 0 ? "font-medium text-slate-900" : "text-slate-400"}`}>{formatMoney(p.outstanding, p.currency)}</Td>
                      <Td className="whitespace-nowrap"><div className={p.effectiveStatus === "OVERDUE" ? "font-medium text-rose-600" : ""}>{formatDate(p.dueDate)}</div>{p.paymentDate && <div className="text-xs text-slate-400">Paid {formatDate(p.paymentDate)}</div>}</Td>
                      <Td>{badge(p)}</Td>
                      <Td>{actions(p, true)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {pageRows.map((p) => (
                <li key={p.id} className={`space-y-2 p-3 ${p.isDeleted ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="font-medium text-slate-900">{p.invoiceNumber}</p><p className="truncate text-xs text-slate-500">{projectId ? clientName(p.clientId) : `${projectName(p.projectId)} · ${clientName(p.clientId)}`}</p></div>
                    {badge(p)}
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div><dt className="text-slate-400">Amount</dt><dd className="font-medium tabular-nums">{formatMoney(p.amount, p.currency)}</dd></div>
                    <div><dt className="text-slate-400">Received</dt><dd className="font-medium tabular-nums text-emerald-700">{formatMoney(p.status === "PAID" ? p.amount : p.receivedAmount, p.currency)}</dd></div>
                    <div><dt className="text-slate-400">Outstanding</dt><dd className="font-medium tabular-nums">{formatMoney(p.outstanding, p.currency)}</dd></div>
                  </dl>
                  <div className="flex items-center justify-between text-xs text-slate-500"><span className={p.effectiveStatus === "OVERDUE" ? "text-rose-600" : ""}>Due {formatDate(p.dueDate)}</span>{actions(p)}</div>
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(rows.length / PAGE_SIZE))} total={rows.length} pageSize={PAGE_SIZE} onPage={setPage} />
          </>
        )}
      </Card>
      <PaymentFormModal open={formOpen} onClose={closeForm} payment={editing} projectId={projectId} />
    </div>
  );
}
