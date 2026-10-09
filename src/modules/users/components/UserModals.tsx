"use client";
import { useEffect, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import type { PublicUser } from "@/schemas/entities";
import { ROLES } from "@/schemas/entities";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/Button";
import { Input, Select, enumOptions } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, messageOf } from "@/lib/api";
import { invalidate } from "@/lib/hooks";
import { useLookup } from "@/lib/lookups";
import { label } from "@/utils/format";

export function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
  const a = new Uint32Array(14);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join("");
}

const refreshAll = () => invalidate("/api/users", "/api/team", "/api/tasks");

/** Create or edit a team member. */
export function UserFormModal({ open, onClose, user }: { open: boolean; onClose: () => void; user?: PublicUser | null }) {
  const toast = useToast();
  const lookup = useLookup();
  const editing = !!user;
  const [f, setF] = useState({ name: "", email: "", role: "DEVELOPER", hourlyRate: "0", dailyRate: "0", password: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr({});
    setF(user
      ? { name: user.name, email: user.email, role: user.role, hourlyRate: String(user.hourlyRate), dailyRate: String(user.dailyRate), password: "" }
      : { name: "", email: "", role: "DEVELOPER", hourlyRate: "0", dailyRate: "0", password: "" });
  }, [open, user]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!f.name.trim()) errors.name = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) errors.email = "Enter a valid email address";
    if (!editing && f.password.length < 8) errors.password = "Password must be at least 8 characters";
    if (Number(f.hourlyRate) < 0 || Number.isNaN(Number(f.hourlyRate))) errors.hourlyRate = "Enter a valid rate";
    if (Number(f.dailyRate) < 0 || Number.isNaN(Number(f.dailyRate))) errors.dailyRate = "Enter a valid rate";
    setErr(errors);
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      const body = { name: f.name, email: f.email, role: f.role, hourlyRate: Number(f.hourlyRate), dailyRate: Number(f.dailyRate) };
      if (editing) await api.put(`/api/users/${user!.id}`, body);
      else await api.post("/api/users", { ...body, password: f.password });
      toast.success(editing ? "Member updated" : "Member added");
      await refreshAll();
      lookup.reload();
      onClose();
    } catch (ex) {
      const msg = messageOf(ex);
      if (ex instanceof ApiError && ex.code === "CONFLICT") setErr({ email: msg });
      else if (ex instanceof ApiError && ex.code === "VALIDATION_ERROR") toast.error(msg);
      else toast.error(ex);
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit team member" : "Add team member"}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="user-form" loading={busy}>{editing ? "Save changes" : "Add member"}</Button></>}>
      <form id="user-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate>
        <Input wrapperClassName="sm:col-span-2" label="Full name" required value={f.name} onChange={set("name")} error={err.name} />
        <Input wrapperClassName="sm:col-span-2" label="Email" type="email" required value={f.email} onChange={set("email")} error={err.email} />
        <Select label="Role" value={f.role} onChange={set("role")}>{enumOptions(ROLES, label)}</Select>
        <span className="hidden sm:block" />
        <Input label="Hourly rate (₹)" type="number" min={0} value={f.hourlyRate} onChange={set("hourlyRate")} error={err.hourlyRate} />
        <Input label="Daily rate (₹)" type="number" min={0} value={f.dailyRate} onChange={set("dailyRate")} error={err.dailyRate} />
        {!editing && (
          <div className="sm:col-span-2">
            <Input label="Initial password" type="text" autoComplete="new-password" required value={f.password} onChange={set("password")} error={err.password} hint="At least 8 characters. Share it securely; they can change it in Settings." />
            <Button variant="ghost" size="xs" className="mt-1" icon={<RefreshCw className="size-3.5" />} onClick={() => setF((s) => ({ ...s, password: generatePassword() }))}>Generate</Button>
          </div>
        )}
      </form>
    </Modal>
  );
}

export function ResetPasswordModal({ user, onClose }: { user: PublicUser | null; onClose: () => void }) {
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) { setPw(generatePassword()); setError(null); } }, [user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError("Password must be at least 8 characters");
    setBusy(true);
    try {
      await api.post(`/api/users/${user!.id}/password`, { newPassword: pw });
      toast.success(`Access reset for ${user!.name}. Their old sessions are signed out.`);
      onClose();
    } catch (ex) { setError(messageOf(ex)); } finally { setBusy(false); }
  }
  const copy = async () => { try { await navigator.clipboard.writeText(pw); toast.success("Password copied"); } catch { toast.info("Select the text and copy it manually"); } };

  return (
    <Modal open={!!user} onClose={onClose} title="Reset access" description={user ? `Set a new password for ${user.name}. Existing sessions will be invalidated.` : undefined} size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="reset-form" loading={busy}>Reset password</Button></>}>
      <form id="reset-form" onSubmit={submit} className="space-y-2">
        <Input label="New password" value={pw} onChange={(e) => { setPw(e.target.value); setError(null); }} error={error} autoComplete="new-password" className="font-mono" />
        <div className="flex gap-2">
          <Button variant="outline" size="xs" icon={<RefreshCw className="size-3.5" />} onClick={() => setPw(generatePassword())}>Generate</Button>
          <Button variant="outline" size="xs" icon={<Copy className="size-3.5" />} onClick={copy}>Copy</Button>
        </div>
      </form>
    </Modal>
  );
}
