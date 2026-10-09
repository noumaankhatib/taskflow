"use client";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "./cn";

const control =
  "w-full rounded-lg border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors " +
  "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-500";
const ok = "border-slate-300";
const bad = "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20";

export function Field({
  label, error, hint, required, children, className, htmlFor,
}: { label?: string; error?: string | null; hint?: string; required?: boolean; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-600">
          {label}
          {required && <span className="text-rose-500"> *</span>}
        </label>
      )}
      {children}
      {error ? <p role="alert" className="text-xs text-rose-600">{error}</p> : hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

type FieldWrap = { label?: string; error?: string | null; hint?: string; wrapperClassName?: string };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldWrap>(function Input(
  { label, error, hint, wrapperClassName, className, required, id, ...rest }, ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} required={required} className={wrapperClassName} htmlFor={fid}>
      <input ref={ref} id={fid} required={required} aria-invalid={!!error} className={cn(control, "h-9", error ? bad : ok, className)} {...rest} />
    </Field>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrap>(function Textarea(
  { label, error, hint, wrapperClassName, className, required, id, rows = 3, ...rest }, ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} required={required} className={wrapperClassName} htmlFor={fid}>
      <textarea ref={ref} id={fid} rows={rows} aria-invalid={!!error} className={cn(control, "py-2", error ? bad : ok, className)} {...rest} />
    </Field>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldWrap>(function Select(
  { label, error, hint, wrapperClassName, className, required, id, children, ...rest }, ref,
) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} error={error} hint={hint} required={required} className={wrapperClassName} htmlFor={fid}>
      <select ref={ref} id={fid} aria-invalid={!!error} className={cn(control, "h-9 pr-8", error ? bad : ok, className)} {...rest}>
        {children}
      </select>
    </Field>
  );
});

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700", className)}>
      <input type="checkbox" className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" {...rest} />
      {label}
    </label>
  );
}

export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input type="search" className={cn(control, ok, "h-9 pl-8")} {...rest} />
    </div>
  );
}

/** Option helper for enum selects. */
export const enumOptions = (values: readonly string[], labeler: (v: string) => string) =>
  values.map((v) => (
    <option key={v} value={v}>
      {labeler(v)}
    </option>
  ));
