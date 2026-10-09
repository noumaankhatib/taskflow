"use client";
import { CheckCircle2, CirclePlus, MessageSquare, Pencil, Receipt, RotateCcw, Trash2, UserPlus, ArrowRightLeft, Clock, CreditCard, FileUp, ShieldCheck, Archive } from "lucide-react";
import type { ReactNode } from "react";
import type { Activity } from "@/schemas/entities";
import { Avatar } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { useLookup } from "@/lib/lookups";
import { timeAgo } from "@/utils/format";

const ICONS: Record<string, ReactNode> = {
  CREATED: <CirclePlus className="size-3.5" />, UPDATED: <Pencil className="size-3.5" />, DELETED: <Trash2 className="size-3.5" />,
  RESTORED: <RotateCcw className="size-3.5" />, STATUS_CHANGED: <ArrowRightLeft className="size-3.5" />, ASSIGNMENT_CHANGED: <UserPlus className="size-3.5" />,
  EXPENSE_ADDED: <Receipt className="size-3.5" />, PAYMENT_ADDED: <CreditCard className="size-3.5" />, COMMENT_ADDED: <MessageSquare className="size-3.5" />,
  TIME_LOGGED: <Clock className="size-3.5" />, APPROVED: <CheckCircle2 className="size-3.5" />, REJECTED: <ShieldCheck className="size-3.5" />,
  FILE_UPLOADED: <FileUp className="size-3.5" />, BACKUP: <Archive className="size-3.5" />, RESTORED_BACKUP: <Archive className="size-3.5" />,
};

/** Audit-trail feed, newest first. */
export function ActivityTimeline({ items, emptyText = "No activity yet." }: { items: Activity[]; emptyText?: string }) {
  const { usersById } = useLookup();
  if (!items.length) return <EmptyState title="Nothing here yet" description={emptyText} />;
  return (
    <ol className="space-y-4">
      {items.map((a) => {
        const u = usersById.get(a.userId);
        return (
          <li key={a.id} className="flex gap-3">
            <div className="relative">
              <Avatar name={u?.name ?? a.userId} src={u?.avatar} size={28} />
              <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-slate-100 text-slate-500 ring-2 ring-white">{ICONS[a.action] ?? <Pencil className="size-3" />}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-800">{a.message || `${a.action} ${a.entityType} ${a.entityId}`}</p>
              <p className="text-xs text-slate-400" title={new Date(a.createdAt).toLocaleString()}>{timeAgo(a.createdAt)} · {a.entityId}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
