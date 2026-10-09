"use client";
import { useEffect, useState } from "react";
import { FileText, Paperclip } from "lucide-react";
import type { Expense } from "@/schemas/entities";
import { CURRENCIES, PAYMENT_METHODS } from "@/schemas/common";
import { EXPENSE_CATEGORIES } from "@/schemas/entities";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, enumOptions } from "@/components/ui/form";
import { UserSelect } from "@/components/ui/pickers";
import { Notice } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, messageOf } from "@/lib/api";
import { invalidate } from "@/lib/hooks";
import { useCan, useLookup, useMe } from "@/lib/lookups";
import { label } from "@/utils/format";

const today = () => new Date().toISOString().slice(0, 10);

export const EXPENSE_INVALIDATE = ["/api/expenses", "/api/projects", "/api/dashboard", "/api/reports", "/api/activity", "/api/notifications"];

interface Props { open: boolean; onClose: () => void; expense?: Expense | null; projectId?: string }

export function ExpenseFormModal({ open, onClose, expense, projectId }: Props) {
  const me = useMe();
  const toast = useToast();
  const { projects } = useLookup();
  const finance = useCan("finance:view");
  const approver = useCan("expense:approve");
  const editing = !!expense;

  const blank = () => ({
    projectId: projectId ?? "", category: "MISCELLANEOUS", description: "", amount: "", currency: "INR",
    date: today(), paidBy: me.id, paymentMethod: "UPI", notes: "",
  });
  const [f, setF] = useState(blank);
  const [file, setFile] = useState<File | null>(null);
  const [attachmentId, setAttachmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null); setFile(null);
    if (expense) {
      setF({ projectId: expense.projectId, category: expense.category, description: expense.description, amount: String(expense.amount), currency: expense.currency, date: expense.date, paidBy: expense.paidBy, paymentMethod: expense.paymentMethod, notes: expense.notes });
      setAttachmentId(expense.attachmentId);
    } else { setF(blank()); setAttachmentId(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const choices = projects.filter((p) => !p.isDeleted && (p.id === f.projectId || !["COMPLETED", "CANCELLED"].includes(p.status) || p.id === projectId));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = Number(f.amount);
    if (!f.projectId) return setError("Select a project.");
    if (!f.amount || Number.isNaN(amount) || amount <= 0) return setError("Expense amount must be greater than zero.");
    setBusy(true);
    try {
      let att = attachmentId;
      if (file) {
        const form = new FormData();
        form.set("file", file); form.set("projectId", f.projectId); form.set("entityType", "EXPENSE");
        att = (await api.upload<{ id: string }>("/api/attachments", form)).id;
      }
      const body = { ...f, amount, attachmentId: att };
      if (editing) await api.put(`/api/expenses/${expense!.id}`, body);
      else await api.post("/api/expenses", body);
      toast.success(editing ? "Expense updated." : approver ? "Expense added." : "Expense submitted for approval.");
      invalidate(...EXPENSE_INVALIDATE);
      onClose();
    } catch (err) { setError(messageOf(err)); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={editing ? `Edit expense ${expense!.id}` : "Add expense"}
      description={!approver && !editing ? "Expenses you submit need approval before they count toward project cost." : undefined}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="expense-form" loading={busy}>{editing ? "Save changes" : "Add expense"}</Button></>}>
      <form id="expense-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        {error && <Notice tone="error" className="sm:col-span-2">{error}</Notice>}
        {editing && !approver && expense!.approvalStatus !== "PENDING" && <Notice tone="warn" className="sm:col-span-2">Saving changes will send this expense back for approval.</Notice>}
        <Select label="Project" required value={f.projectId} onChange={set("projectId")} disabled={!!projectId} wrapperClassName="sm:col-span-2">
          <option value="">Select a project…</option>
          {choices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Input label="Description" required maxLength={300} value={f.description} onChange={set("description")} wrapperClassName="sm:col-span-2" placeholder="e.g. Vercel Pro (3 months)" />
        <Select label="Category" value={f.category} onChange={set("category")}>{enumOptions(EXPENSE_CATEGORIES, (c) => (c === "API" ? "API" : label(c)))}</Select>
        <Input label="Date" type="date" required value={f.date} onChange={set("date")} />
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <Input label="Amount" required type="number" inputMode="decimal" min="0" step="0.01" value={f.amount} onChange={set("amount")} placeholder="0.00" />
          <Select label="Currency" value={f.currency} onChange={set("currency")}>{enumOptions(CURRENCIES, (v) => v)}</Select>
        </div>
        <Select label="Payment method" value={f.paymentMethod} onChange={set("paymentMethod")}>{enumOptions(PAYMENT_METHODS, (m) => (m === "UPI" ? "UPI" : label(m)))}</Select>
        <UserSelect label="Paid by" required value={f.paidBy} onChange={(id) => id && setF((s) => ({ ...s, paidBy: id }))} disabled={!finance} />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Receipt</label>
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600">
            <Paperclip className="size-4" /><span className="truncate">{file ? file.name : attachmentId ? "Replace receipt…" : "Attach file (max 10 MB)"}</span>
            <input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {attachmentId && !file && <a href={`/api/attachments/${attachmentId}`} className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"><FileText className="size-3" />Current receipt</a>}
        </div>
        <Textarea label="Notes" value={f.notes} onChange={set("notes")} wrapperClassName="sm:col-span-2" maxLength={2000} />
      </form>
    </Modal>
  );
}
