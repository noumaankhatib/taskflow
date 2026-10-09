import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./Button";

/** Horizontally scrollable table container (works on mobile). */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("relative overflow-x-auto", className)}><table className="w-full min-w-[640px] text-left text-sm">{children}</table></div>;
}
export const THead = ({ children }: { children: ReactNode }) => <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium uppercase tracking-wide text-slate-500">{children}</thead>;
export const Th = ({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn("whitespace-nowrap px-4 py-2.5 font-medium", className)} {...p} />;
export const Td = ({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("px-4 py-3 align-middle text-slate-700", className)} {...p} />;
export const Tr = ({ className, onClick, ...p }: HTMLAttributes<HTMLTableRowElement>) => (
  <tr onClick={onClick} className={cn("border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50/70", onClick && "cursor-pointer", className)} {...p} />
);

export function SortTh({ label, field, sort, onSort, className }: { label: string; field: string; sort: string; onSort: (s: string) => void; className?: string }) {
  const [f, dir] = sort.split(":");
  const active = f === field;
  return (
    <Th className={className} aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}>
      <button className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800" onClick={() => onSort(`${field}:${active && dir === "asc" ? "desc" : "asc"}`)}>
        {label}
        {active && (dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </Th>
  );
}

export function Pagination({ page, totalPages, total, pageSize, onPage }: { page: number; totalPages: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  if (total <= pageSize) return total ? <div className="px-4 py-3 text-xs text-slate-500">{total} {total === 1 ? "result" : "results"}</div> : null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
      <span>{from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="xs" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="size-3.5" /></Button>
        <span className="px-2">Page {page} of {totalPages}</span>
        <Button variant="outline" size="xs" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="size-3.5" /></Button>
      </div>
    </div>
  );
}
