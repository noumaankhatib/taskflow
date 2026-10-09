"use client";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Drawer } from "@/components/ui/overlay";
import { Badge, ProgressBar, StatusBadge } from "@/components/ui/display";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useApi } from "@/lib/hooks";
import { healthTone, HEALTH_LABEL, projectStatusTone } from "@/lib/status";
import { formatDate, formatMoney } from "@/utils/format";
import type { Client } from "@/schemas/entities";

interface P { id: string; name: string; status: string; progress: number; health: string; contractValue: number; expectedEndDate: string | null }

export function ClientDrawer({ clientId, onClose }: { clientId: string | null; onClose: () => void }) {
  const client = useApi<Client>(clientId ? `/api/clients/${clientId}` : null);
  const projects = useApi<P[]>(clientId ? `/api/projects?clientId=${clientId}&pageSize=100` : null);
  const c = client.data;
  return (
    <Drawer open={!!clientId} onClose={onClose} width="max-w-xl" subtitle="Client" title={c?.companyName ?? "Client"}>
      {client.error ? <ErrorState error={client.error} onRetry={client.reload} /> : !c ? (
        <div className="space-y-3 p-5"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-24 w-full" /></div>
      ) : (
        <div className="space-y-6 p-4 sm:p-5">
          <section className="space-y-2 text-sm">
            <Badge tone={c.active ? "emerald" : "zinc"} dot>{c.active ? "Active" : "Inactive"}</Badge>
            {c.contactPerson && <p className="font-medium text-slate-900">{c.contactPerson}</p>}
            {c.email && <p className="flex items-center gap-2 text-slate-600"><Mail className="size-4 text-slate-400" /><a className="text-indigo-600 hover:underline" href={`mailto:${c.email}`}>{c.email}</a></p>}
            {c.phone && <p className="flex items-center gap-2 text-slate-600"><Phone className="size-4 text-slate-400" />{c.phone}</p>}
            {c.address && <p className="flex items-start gap-2 text-slate-600"><MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />{c.address}</p>}
            <p className="text-xs text-slate-400">Client since {formatDate(c.createdAt)}</p>
          </section>
          {c.notes && <section><h3 className="mb-1 text-sm font-semibold text-slate-900">Notes</h3><p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{c.notes}</p></section>}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Projects ({projects.data?.length ?? 0})</h3>
            {projects.isLoading ? <Skeleton className="h-20 w-full" /> : !projects.data?.length ? <EmptyState title="No projects yet" description="Projects created for this client will appear here." className="py-6" /> : (
              <ul className="space-y-2">
                {projects.data.map((p) => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="block rounded-lg border border-slate-200 p-3 hover:border-slate-300 hover:bg-slate-50/60">
                      <div className="flex items-start justify-between gap-2"><span className="text-sm font-medium text-slate-900">{p.name}</span><StatusBadge value={p.status} tones={projectStatusTone} /></div>
                      <div className="mt-2 flex items-center gap-3"><ProgressBar value={p.progress} tone={p.progress === 100 ? "emerald" : "indigo"} label={`${p.name} progress`} /><span className="text-xs tabular-nums text-slate-500">{p.progress}%</span></div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-slate-500"><span>{formatMoney(p.contractValue)}</span><span>Due {formatDate(p.expectedEndDate)}</span><Badge tone={healthTone[p.health] ?? "slate"}>{HEALTH_LABEL[p.health] ?? p.health}</Badge></div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}
