"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Avatar, Card, CardHeader, PageHeader, Tabs } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, messageOf } from "@/lib/api";
import { invalidate } from "@/lib/hooks";
import { useCan, useLookup, useMe } from "@/lib/lookups";
import { label } from "@/utils/format";
import { BackupsPanel } from "./BackupsPanel";
import { Lock } from "lucide-react";

type Tab = "profile" | "password" | "data";

function Profile() {
  const me = useMe();
  const router = useRouter();
  const toast = useToast();
  const lookup = useLookup();
  const [name, setName] = useState(me.name);
  const [email, setEmail] = useState(me.email);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const dirty = name !== me.name || email !== me.email;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid email address";
    setErr(errors);
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      await api.put(`/api/users/${me.id}`, { name, email });
      toast.success("Profile updated");
      await invalidate("/api/users");
      lookup.reload();
      router.refresh(); // re-read the signed-in user in the layout
    } catch (ex) {
      if (ex instanceof ApiError && ex.code === "CONFLICT") setErr({ email: messageOf(ex) }); else toast.error(ex);
    } finally { setBusy(false); }
  }
  useEffect(() => { setName(me.name); setEmail(me.email); }, [me.name, me.email]);

  return (
    <Card className="max-w-xl">
      <CardHeader title="Profile" description="How you appear to the rest of the team." />
      <div className="mb-4 flex items-center gap-3"><Avatar name={me.name} src={me.avatar} size={48} /><div><p className="text-sm font-medium text-slate-900">{me.name}</p><p className="text-xs text-slate-500">{label(me.role)} · {me.id}</p></div></div>
      <form onSubmit={submit} noValidate className="space-y-3">
        <Input label="Full name" required value={name} onChange={(e) => setName(e.target.value)} error={err.name} />
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={err.email} />
        <Input label="Role" value={label(me.role)} disabled hint="Only an admin can change roles." readOnly />
        <Button type="submit" loading={busy} disabled={!dirty}>Save changes</Button>
      </form>
    </Card>
  );
}

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

function Password() {
  const toast = useToast();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const s = strength(next);
  const bar = ["bg-slate-200", "bg-rose-400", "bg-amber-400", "bg-lime-500", "bg-emerald-500"][next ? Math.max(s, 1) : 0];
  const text = ["", "Weak", "Fair", "Good", "Strong"][next ? Math.max(s, 1) : 0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!cur) errors.cur = "Enter your current password";
    if (next.length < 8) errors.next = "Password must be at least 8 characters";
    if (confirm !== next) errors.confirm = "Passwords don't match";
    setErr(errors);
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      await api.post("/api/auth/password", { currentPassword: cur, newPassword: next });
      toast.success("Password changed");
      setCur(""); setNext(""); setConfirm("");
    } catch (ex) {
      if (ex instanceof ApiError && ex.code === "VALIDATION_ERROR") setErr({ cur: messageOf(ex) }); else toast.error(ex);
    } finally { setBusy(false); }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader title="Change password" description="You'll stay signed in on this device; other sessions are signed out." />
      <form onSubmit={submit} noValidate className="space-y-3">
        <Input label="Current password" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} error={err.cur} />
        <div>
          <Input label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={err.next} />
          {next && <div className="mt-1.5 flex items-center gap-2"><div className="flex flex-1 gap-1" aria-hidden>{[1, 2, 3, 4].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= s ? bar : "bg-slate-200"}`} />)}</div><span className="text-xs text-slate-500">{text}</span></div>}
          <p className="mt-1 text-xs text-slate-400">Use 12+ characters with upper/lower case, numbers and symbols.</p>
        </div>
        <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={err.confirm} />
        <Button type="submit" loading={busy}>Update password</Button>
      </form>
    </Card>
  );
}

export function SettingsPage() {
  const canBackup = useCan("backup:manage");
  const router = useRouter();
  const sp = useSearchParams();
  const t = sp.get("tab");
  const tab: Tab = t === "password" || t === "data" ? t : "profile";
  const setTab = (id: Tab) => router.replace(id === "profile" ? "/settings" : `/settings?tab=${id}`, { scroll: false });

  return (
    <>
      <PageHeader title="Settings" description="Your account and, for admins, data management." />
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ id: "profile", label: "Profile" }, { id: "password", label: "Password" }, { id: "data", label: "Data & backups" }]} />
      {tab === "profile" && <Profile />}
      {tab === "password" && <Password />}
      {tab === "data" && (canBackup ? <BackupsPanel /> : (
        <Card><EmptyState icon={<Lock className="size-5" />} title="Admins only" description="Backups, export and import are restricted to administrators. Ask an admin if you need a copy of the data." /></Card>
      ))}
    </>
  );
}
