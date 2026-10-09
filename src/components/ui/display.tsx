"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { toneClasses, dotClasses, type Tone } from "@/lib/status";
import { label as humanLabel } from "@/utils/format";

export function Badge({ tone = "slate", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", toneClasses[tone], className)}>
      {dot && <span className={cn("size-1.5 rounded-full", dotClasses[tone])} />}
      {children}
    </span>
  );
}

/** Enum value → coloured badge, e.g. <StatusBadge value="IN_PROGRESS" tones={taskStatusTone} /> */
export function StatusBadge({ value, tones, text, className }: { value: string; tones: Record<string, Tone>; text?: string; className?: string }) {
  return (
    <Badge tone={tones[value] ?? "slate"} dot className={className}>
      {text ?? humanLabel(value)}
    </Badge>
  );
}

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <section className={cn("min-w-0 rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]", padded && "p-4 sm:p-5", className)}>{children}</section>;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-block text-xs font-medium text-slate-500 hover:text-indigo-600">
            ← {back.label}
          </Link>
        )}
        <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone, icon, href }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "bad" | "warn"; icon?: ReactNode; href?: string }) {
  const body = (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300">
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
        <span>{label}</span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className={cn("mt-1.5 text-2xl font-semibold tabular-nums tracking-tight", tone === "good" && "text-emerald-600", tone === "bad" && "text-rose-600", tone === "warn" && "text-amber-600", !tone && "text-slate-900")}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

const AVATAR_COLORS = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-sky-500", "bg-violet-500", "bg-teal-500", "bg-orange-500"];
export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}
export function Avatar({ name, src, size = 28, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const color = AVATAR_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.4) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} title={name} style={style} className={cn("shrink-0 rounded-full object-cover ring-2 ring-white", className)} />;
  }
  return (
    <span title={name} aria-label={name} style={style} className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ring-2 ring-white", color, className)}>
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = 24 }: { people: { id: string; name: string; avatar?: string | null }[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((p) => <Avatar key={p.id} name={p.name} src={p.avatar} size={size} />)}
      {extra > 0 && (
        <span style={{ width: size, height: size, fontSize: 10 }} className="inline-flex items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600 ring-2 ring-white">+{extra}</span>
      )}
    </div>
  );
}

export function ProgressBar({ value, tone = "indigo", className, label }: { value: number; tone?: "indigo" | "emerald" | "amber" | "rose"; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const color = { indigo: "bg-indigo-500", emerald: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500" }[tone];
  return (
    <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cn("h-full rounded-full transition-[width]", color)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: string; count?: number; icon?: ReactNode }[]; value: T; onChange: (id: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn("no-scrollbar -mb-px flex gap-1 overflow-x-auto border-b border-slate-200", className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === value}
          onClick={() => onChange(t.id)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
            t.id === value ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          {t.icon}
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Segmented control (e.g. Board / List). */
export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string; icon?: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={o.id === value}
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors", o.id === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-xs font-medium text-slate-500">{i.label}</dt>
          <dd className="mt-0.5 text-sm text-slate-900">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
