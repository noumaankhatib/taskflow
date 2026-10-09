"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import type { Notification } from "@/schemas/entities";
import { Popover } from "@/components/ui/menu";
import { cn } from "@/components/ui/cn";
import { dotClasses, severityTone } from "@/lib/status";
import { entityHref } from "@/lib/links";
import { api } from "@/lib/api";
import { invalidate, useApi } from "@/lib/hooks";
import { timeAgo } from "@/utils/format";

export function NotificationBell() {
  const router = useRouter();
  const { data, meta } = useApi<Notification[]>("/api/notifications?pageSize=6", { refreshInterval: 60_000 });
  const unread = (meta?.unread as number | undefined) ?? 0;

  async function open(n: Notification, close: () => void) {
    close();
    if (!n.isRead) { await api.put(`/api/notifications/${n.id}/read`).catch(() => undefined); invalidate("/api/notifications"); }
    const href = entityHref(n.entityType, n.entityId);
    if (href) router.push(href);
  }

  return (
    <Popover align="right" width="w-[min(22rem,calc(100vw-1.5rem))]" trigger={({ toggle }) => (
      <button onClick={toggle} aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100">
        <Bell className="size-5" />
        {unread > 0 && <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
    )}>
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-3 py-2"><span className="text-sm font-semibold text-slate-900">Notifications</span><Link href="/notifications" onClick={close} className="text-xs font-medium text-indigo-600 hover:underline">View all</Link></div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {(data ?? []).map((n) => (
              <li key={n.id}>
                <button onClick={() => open(n, close)} className={cn("flex w-full gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50", !n.isRead && "bg-indigo-50/40")}>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : dotClasses[severityTone[n.severity] ?? "blue"])} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{n.title}</span><span className="line-clamp-2 text-xs text-slate-500">{n.message}</span><span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span></span>
                </button>
              </li>
            ))}
            {!data?.length && <li className="py-8 text-center text-sm text-slate-400">You&apos;re all caught up</li>}
          </ul>
        </div>
      )}
    </Popover>
  );
}
