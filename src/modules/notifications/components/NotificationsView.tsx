"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, Trash2, Undo2 } from "lucide-react";
import type { Notification } from "@/schemas/entities";
import { Badge, Card, PageHeader, Segmented } from "@/components/ui/display";
import { Button, IconButton } from "@/components/ui/Button";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";
import { api } from "@/lib/api";
import { invalidate, useApi, useAsyncAction } from "@/lib/hooks";
import { entityHref } from "@/lib/links";
import { severityTone } from "@/lib/status";
import { label, timeAgo } from "@/utils/format";

const ICON = { INFO: Info, SUCCESS: CheckCircle2, WARNING: AlertTriangle, ERROR: AlertCircle } as const;
const ICON_COLOR = { INFO: "text-blue-500", SUCCESS: "text-emerald-500", WARNING: "text-amber-500", ERROR: "text-rose-500" } as const;
const PAGE_SIZE = 20;

export function NotificationsView() {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const url = `/api/notifications?pageSize=${PAGE_SIZE}&page=${page}${filter === "unread" ? "&unread=true" : ""}`;
  const { data, meta, error, isLoading, reload } = useApi<Notification[]>(url);
  const unread = (meta?.unread as number | undefined) ?? 0;
  const refresh = () => invalidate("/api/notifications");

  const [markAll, markingAll] = useAsyncAction(async () => {
    await api.post("/api/notifications/read-all");
    await refresh();
    toast.success("All notifications marked as read");
  }, toast.error);
  const [toggle] = useAsyncAction(async (n: Notification) => { await api.put(`/api/notifications/${n.id}/read`, { isRead: !n.isRead }); await refresh(); }, toast.error);
  const [remove] = useAsyncAction(async (n: Notification) => { await api.del(`/api/notifications/${n.id}`); await refresh(); toast.success("Notification deleted"); }, toast.error);

  async function open(n: Notification) {
    if (!n.isRead) await api.put(`/api/notifications/${n.id}/read`).then(refresh).catch(() => undefined);
    const href = entityHref(n.entityType, n.entityId);
    if (href) router.push(href);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Notifications" description={unread ? `${unread} unread` : "You're all caught up"}
        actions={<Button variant="outline" size="sm" icon={<CheckCheck className="size-4" />} loading={markingAll} disabled={!unread} onClick={() => markAll()}>Mark all as read</Button>} />
      <Segmented value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[{ id: "all", label: "All" }, { id: "unread", label: `Unread${unread ? ` (${unread})` : ""}` }]} />
      <Card padded={false}>
        {isLoading && !data ? <TableSkeleton rows={6} cols={3} />
          : error && !data ? <ErrorState error={error} onRetry={reload} />
          : !data?.length ? <EmptyState icon={<Bell className="size-5" />} title={filter === "unread" ? "No unread notifications" : "No notifications yet"} description="Task assignments, mentions, approvals and payments will show up here." />
          : (
            <ul className="divide-y divide-slate-100">
              {data.map((n) => {
                const Icon = ICON[n.severity];
                const href = entityHref(n.entityType, n.entityId);
                return (
                  <li key={n.id} className={cn("group flex items-start gap-3 px-4 py-3.5", !n.isRead && "bg-indigo-50/40")}>
                    <Icon className={cn("mt-0.5 size-5 shrink-0", ICON_COLOR[n.severity])} aria-hidden />
                    <button onClick={() => open(n)} disabled={!href && n.isRead} className="min-w-0 flex-1 text-left">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={cn("text-sm text-slate-900", !n.isRead ? "font-semibold" : "font-medium")}>{n.title}</span>
                        {!n.isRead && <span className="size-2 rounded-full bg-indigo-500" aria-label="Unread" />}
                        <Badge tone={severityTone[n.severity]}>{label(n.type)}</Badge>
                      </span>
                      {n.message && <span className="mt-0.5 block text-sm text-slate-600">{n.message}</span>}
                      <span className="mt-1 block text-xs text-slate-400">{timeAgo(n.createdAt)}{n.entityType && n.entityId ? ` · ${n.entityType.toLowerCase()} ${n.entityId}` : ""}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <IconButton label={n.isRead ? "Mark as unread" : "Mark as read"} onClick={() => toggle(n)}>{n.isRead ? <Undo2 className="size-4" /> : <CheckCheck className="size-4" />}</IconButton>
                      <IconButton label="Delete notification" onClick={() => remove(n)}><Trash2 className="size-4" /></IconButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPage={setPage} />}
      </Card>
    </div>
  );
}
