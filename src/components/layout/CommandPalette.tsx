"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BriefcaseBusiness, CheckSquare, Receipt, Search, User, Building2 } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { Spinner } from "@/components/ui/feedback";
import { useApi, useDebounced } from "@/lib/hooks";
import { cn } from "@/components/ui/cn";
import type { SearchHit } from "@/services/SearchService";

const ICON = { project: BriefcaseBusiness, task: CheckSquare, client: Building2, user: User, expense: Receipt } as const;
const GROUP = { project: "Projects", task: "Tasks", client: "Clients", user: "Team", expense: "Expenses" } as const;

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const dq = useDebounced(q.trim(), 200);
  const { data, isLoading } = useApi<SearchHit[]>(open && dq.length >= 2 ? `/api/search?q=${encodeURIComponent(dq)}` : null);
  const hits = dq.length >= 2 ? data ?? [] : [];
  useEffect(() => setIdx(0), [dq]);
  useEffect(() => { if (!open) setQ(""); }, [open]);

  const go = (h: SearchHit) => { onClose(); router.push(h.href); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && hits[idx]) go(hits[idx]);
  };

  return (
    <Modal open={open} onClose={onClose} title="Search" size="md">
      <div className="-mt-1" onKeyDown={onKey}>
        <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
          <Search className="size-4 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects, tasks, clients, team, expenses…" aria-label="Search" className="h-10 flex-1 bg-transparent text-sm outline-none" />
          {isLoading && dq.length >= 2 && <Spinner className="size-4" />}
        </div>
        <ul className="mt-3 max-h-80 space-y-0.5 overflow-y-auto" role="listbox">
          {hits.map((h, i) => {
            const Icon = ICON[h.type];
            return (
              <li key={h.type + h.id}>
                <button role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => go(h)}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left", i === idx ? "bg-indigo-50" : "hover:bg-slate-50")}>
                  <Icon className="size-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{h.title}</span><span className="block truncate text-xs text-slate-500">{h.subtitle}</span></span>
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">{GROUP[h.type]}</span>
                </button>
              </li>
            );
          })}
          {dq.length >= 2 && !isLoading && !hits.length && <li className="py-8 text-center text-sm text-slate-500">No results for &ldquo;{dq}&rdquo;</li>}
          {dq.length < 2 && <li className="py-8 text-center text-sm text-slate-400">Type at least 2 characters. Use ↑ ↓ and Enter to navigate.</li>}
        </ul>
      </div>
    </Modal>
  );
}
