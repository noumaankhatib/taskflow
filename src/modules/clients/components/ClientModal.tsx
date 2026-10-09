"use client";
import { useEffect, useState } from "react";
import type { Client } from "@/schemas/entities";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, messageOf } from "@/lib/api";
import { invalidate } from "@/lib/hooks";
import { useLookup } from "@/lib/lookups";

const empty = { companyName: "", contactPerson: "", email: "", phone: "", address: "", notes: "", active: true };

export function ClientModal({ open, onClose, client }: { open: boolean; onClose: () => void; client?: Client | null }) {
  const toast = useToast();
  const lookup = useLookup();
  const [f, setF] = useState(empty);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErr({});
    setF(client ? { companyName: client.companyName, contactPerson: client.contactPerson, email: client.email, phone: client.phone, address: client.address, notes: client.notes, active: client.active } : empty);
  }, [open, client]);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!f.companyName.trim()) errors.companyName = "Company name is required";
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) errors.email = "Enter a valid email address";
    setErr(errors);
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      if (client) await api.put(`/api/clients/${client.id}`, f);
      else await api.post("/api/clients", f);
      toast.success(client ? "Client updated" : "Client added");
      await invalidate("/api/clients");
      lookup.reload();
      onClose();
    } catch (ex) {
      if (ex instanceof ApiError && ex.code === "CONFLICT") setErr({ companyName: messageOf(ex) });
      else toast.error(ex);
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={client ? "Edit client" : "Add client"} size="lg"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="client-form" loading={busy}>{client ? "Save changes" : "Add client"}</Button></>}>
      <form id="client-form" onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2">
        <Input wrapperClassName="sm:col-span-2" label="Company name" required value={f.companyName} onChange={set("companyName")} error={err.companyName} />
        <Input label="Contact person" value={f.contactPerson} onChange={set("contactPerson")} />
        <Input label="Phone" type="tel" value={f.phone} onChange={set("phone")} />
        <Input wrapperClassName="sm:col-span-2" label="Email" type="email" value={f.email} onChange={set("email")} error={err.email} />
        <Textarea wrapperClassName="sm:col-span-2" label="Address" rows={2} value={f.address} onChange={set("address")} />
        <Textarea wrapperClassName="sm:col-span-2" label="Notes" value={f.notes} onChange={set("notes")} />
        <Checkbox label="Active client" checked={f.active} onChange={(e) => setF((s) => ({ ...s, active: e.target.checked }))} />
      </form>
    </Modal>
  );
}
