"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "./cn";
import { messageOf } from "@/lib/api";

type Kind = "success" | "error" | "info";
interface ToastItem { id: number; kind: Kind; message: string }
interface ToastApi { success: (m: string) => void; error: (e: unknown) => void; info: (m: string) => void }

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: Kind, message: string) => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-3), { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3500);
  }, [dismiss]);
  const api = useMemo<ToastApi>(() => ({
    success: (m) => push("success", m),
    info: (m) => push("info", m),
    error: (e) => push("error", typeof e === "string" ? e : messageOf(e)),
  }), [push]);
  const icon = { success: <CheckCircle2 className="size-4 text-emerald-500" />, error: <AlertCircle className="size-4 text-rose-500" />, info: <Info className="size-4 text-sky-500" /> };
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"} className={cn("tf-pop pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-lg border bg-white px-3.5 py-2.5 text-sm shadow-lg", t.kind === "error" ? "border-rose-200" : "border-slate-200")}>
            <span className="mt-0.5">{icon[t.kind]}</span>
            <span className="text-slate-800">{t.message}</span>
            <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="ml-1 text-slate-400 hover:text-slate-600"><X className="size-3.5" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export function useToast() {
  const t = useContext(ToastContext);
  if (!t) throw new Error("useToast must be used inside <ToastProvider>");
  return t;
}
