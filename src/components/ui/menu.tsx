"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "./cn";
import { IconButton } from "./Button";

export interface MenuItem { label: string; onSelect: () => void; icon?: ReactNode; danger?: boolean; hidden?: boolean; disabled?: boolean }

/** Small popover menu. Closes on outside click, Escape, or selection. */
export function Menu({ items, trigger, align = "right", label = "More actions" }: { items: MenuItem[]; trigger?: ReactNode; align?: "left" | "right"; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);
  const visible = items.filter((i) => !i.hidden);
  if (!visible.length) return null;
  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      {trigger ? (
        <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{trigger}</button>
      ) : (
        <IconButton label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}><MoreHorizontal className="size-4" /></IconButton>
      )}
      {open && (
        <div role="menu" className={cn("tf-pop absolute z-40 mt-1 min-w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg", align === "right" ? "right-0" : "left-0")}>
          {visible.map((i) => (
            <button key={i.label} role="menuitem" disabled={i.disabled} onClick={() => { setOpen(false); i.onSelect(); }}
              className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 disabled:opacity-40", i.danger ? "text-rose-600" : "text-slate-700")}>
              {i.icon}{i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Generic popover container (used by pickers). */
export function Popover({ trigger, children, align = "left", width = "w-64" }: { trigger: (o: { open: boolean; toggle: () => void }) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setOpen(false));
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key, true); };
  }, [open]);
  return (
    <div ref={ref} className="relative block w-full" onClick={(e) => e.stopPropagation()}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && <div className={cn("tf-pop absolute z-40 mt-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg", width, align === "right" ? "right-0" : "left-0")}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
