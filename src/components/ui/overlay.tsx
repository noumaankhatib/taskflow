"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./cn";
import { Button, IconButton } from "./Button";

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), onClose());
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

/** Lock body scroll and move focus into the panel while open. */
function usePanelFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const el = ref.current?.querySelector<HTMLElement>("[autofocus], input:not([type=hidden]), textarea, select, button");
    (el ?? ref.current)?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);
  return ref;
}

function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

export function Modal({
  open, onClose, title, description, children, footer, size = "md",
}: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  useEscape(open, onClose);
  const ref = usePanelFocus(open);
  if (!open) return null;
  const w = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <div className="tf-fade absolute inset-0 bg-slate-900/40" onMouseDown={onClose} aria-hidden />
        <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={cn("tf-pop relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl", w)}>
          <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
            <IconButton label="Close" onClick={onClose}><X className="size-4" /></IconButton>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</footer>}
        </div>
      </div>
    </Portal>
  );
}

/** Right-hand panel (full width on phones). */
export function Drawer({
  open, onClose, title, subtitle, children, footer, width = "max-w-2xl", actions,
}: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: string; actions?: ReactNode }) {
  useEscape(open, onClose);
  const ref = usePanelFocus(open);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="tf-fade absolute inset-0 bg-slate-900/40" onMouseDown={onClose} aria-hidden />
        <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1} className={cn("tf-slide-in relative flex h-full w-full flex-col bg-white shadow-2xl", width)}>
          <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            </div>
            <div className="flex items-center gap-1">
              {actions}
              <IconButton label="Close panel" onClick={onClose}><X className="size-4" /></IconButton>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <footer className="border-t border-slate-100 px-4 py-3 sm:px-5">{footer}</footer>}
        </div>
      </div>
    </Portal>
  );
}

/* ------------------------------ confirm dialogs ------------------------------ */
interface ConfirmOptions { title: string; message?: ReactNode; confirmLabel?: string; destructive?: boolean }
const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state} onClose={() => close(false)} title={state?.title ?? ""} size="sm"
        footer={<>
          <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
          <Button variant={state?.destructive ? "danger" : "primary"} onClick={() => close(true)} autoFocus>{state?.confirmLabel ?? "Confirm"}</Button>
        </>}
      >
        <div className="text-sm text-slate-600">{state?.message}</div>
      </Modal>
    </ConfirmContext.Provider>
  );
}
/** `if (await confirm({ title: "Delete project?", destructive: true })) …` */
export function useConfirm() {
  const c = useContext(ConfirmContext);
  if (!c) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return c;
}
