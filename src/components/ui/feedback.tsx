"use client";
import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./Button";

export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-md bg-slate-200/70", className)} />;

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn("size-5 animate-spin text-slate-400", className)} aria-label="Loading" />;

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-slate-100" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }, (_, c) => <Skeleton key={c} className={cn("h-4", c === 0 ? "w-1/3" : "w-1/6")} />)}
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">{icon ?? <Inbox className="size-5" />}</div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error?: unknown; onRetry?: () => void; className?: string }) {
  const msg = error instanceof Error ? error.message : "Something went wrong. Please try again.";
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-rose-50 text-rose-500"><AlertTriangle className="size-5" /></div>
      <h3 className="text-sm font-semibold text-slate-900">We couldn&apos;t load this</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{msg}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode; className?: string }) {
  const t = { info: "bg-sky-50 text-sky-800 border-sky-200", warn: "bg-amber-50 text-amber-900 border-amber-200", error: "bg-rose-50 text-rose-800 border-rose-200", success: "bg-emerald-50 text-emerald-800 border-emerald-200" }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-lg border px-3 py-2 text-sm", t, className)}>{children}</div>;
}
