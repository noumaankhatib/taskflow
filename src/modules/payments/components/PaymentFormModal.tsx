"use client";
import { useEffect, useState } from "react";
import type { Payment } from "@/schemas/entities";
import { PAYMENT_STATUSES } from "@/schemas/entities";
import { CURRENCIES, PAYMENT_METHODS } from "@/schemas/common";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, enumOptions, Field } from "@/components/ui/form";
import { Notice } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, messageOf } from "@/lib/api";
import { invalidate } from "@/lib/hooks";
import { useLookup } from "@/lib/lookups";
import { formatMoney, label } from "@/utils/format";

export const PAYMENT_INVALIDATE = ["/api/payments", "/api/projects", "/api/dashboard", "/api/reports", "/api/activity", "/api/notifications"];

export function PaymentFormModal({ open, onClose, payment, projectId }: { open: boolean; onClose: () => void; payment?: Payment | null; projectId?: string }) {
  const toast = useToast();
  const { projects, clientName, projectsById } = useLookup();
  const editing = !!payment;
  const blank = () => ({ projectId: projectId ?? "", invoiceNumber: "", amount: "", currency: "INR", status: "PENDING", receivedAmount: "", paymentDate: "", dueDate: "", paymentMethod: "", notes: "" });
  const [f, setF] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setF(payment ? {
      projectId: payment.projectId, invoiceNumber: payment.invoiceNumber, amount: String(payment.amount), currency: payment.currency, status: payment.status,
      receivedAmount: payment.receivedAmount ? String(payment.receivedAmount) : "", paymentDate: payment.paymentDate ?? "", dueDate: payment.dueDate ?? "",
      paymentMethod: payment.paymentMethod ?? "", notes: payment.notes,
    } : blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment?.id]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const project = projectsById.get(f.projectId);
  const partial = f.status === "PARTIALLY_PAID";
  const paidLike = f.status === "PAID" || partial;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = Number(f.amount);
    if (!f.projectId) return setError("Select a project.");
    if (!f.amount || Number.isNaN(amount) || amount <= 0) return setError("Amount must be greater than zero.");
    const received = f.receivedAmount === "" ? 0 : Number(f.receivedAmount);
    if (partial && !(received > 0 && received < amount)) return setError("For a partially paid invoice, received amount must be above 0 and below the invoice amount.");
    setBusy(true);
    try {
      const body = {
        ...(editing ? {} : { projectId: f.projectId }), invoiceNumber: f.invoiceNumber, amount, currency: f.currency, status: f.status,
        receivedAmount: partial ? received : f.status === "PAID" ? amount : 0, paymentDate: f.paymentDate, dueDate: f.dueDate,
        paymentMethod: f.paymentMethod, notes: f.notes,
      };
      if (editing) await api.put(`/api/payments/${payment!.id}`, body); else await api.post("/api/payments", body);
      toast.success(editing ? "Payment updated." : "Payment added.");
      invalidate(...PAYMENT_INVALIDATE);
      onClose();
    } catch (err) { setError(messageOf(err)); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={editing ? `Edit payment ${payment!.id}` : "Add payment / invoice"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="payment-form" loading={busy}>{editing ? "Save changes" : "Add payment"}</Button></>}>
      <form id="payment-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        {error && <Notice tone="error" className="sm:col-span-2">{error}</Notice>}
        <Select label="Project" required value={f.projectId} onChange={set("projectId")} disabled={!!projectId || editing}>
          <option value="">Select a project…</option>
          {projects.filter((p) => !p.isDeleted).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Field label="Client"><div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">{project ? clientName(project.clientId) : "Derived from project"}</div></Field>
        <Input label="Invoice number" required maxLength={60} value={f.invoiceNumber} onChange={set("invoiceNumber")} placeholder="INV-2026-011" />
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <Input label="Amount" required type="number" min="0" step="0.01" inputMode="decimal" value={f.amount} onChange={set("amount")} />
          <Select label="Currency" value={f.currency} onChange={set("currency")}>{enumOptions(CURRENCIES, (v) => v)}</Select>
        </div>
        <Select label="Status" value={f.status} onChange={set("status")}>{enumOptions(PAYMENT_STATUSES.filter((s) => s !== "OVERDUE"), label)}</Select>
        {partial ? <Input label="Received amount" required type="number" min="0" step="0.01" value={f.receivedAmount} onChange={set("receivedAmount")} hint={f.amount ? `Between 0 and ${formatMoney(Number(f.amount), f.currency)}` : undefined} /> : <div className="hidden sm:block" />}
        <Input label="Due date" type="date" value={f.dueDate} onChange={set("dueDate")} hint="Unpaid invoices past this date show as Overdue" />
        <Input label={paidLike ? "Payment date" : "Payment date (when received)"} type="date" value={f.paymentDate} onChange={set("paymentDate")} />
        <Select label="Payment method" value={f.paymentMethod} onChange={set("paymentMethod")}><option value="">—</option>{enumOptions(PAYMENT_METHODS, (m) => (m === "UPI" ? "UPI" : label(m)))}</Select>
        <Textarea label="Notes" value={f.notes} onChange={set("notes")} wrapperClassName="sm:col-span-2" maxLength={2000} />
      </form>
    </Modal>
  );
}
