"use client";
import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Avatar } from "./display";
import { Popover } from "./menu";
import { Field } from "./form";
import { cn } from "./cn";
import { useLookup } from "@/lib/lookups";

interface Person { id: string; name: string; avatar?: string | null; active?: boolean }

const triggerCls = "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm hover:border-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

/** Choose one user from `people` (defaults to everyone active). */
export function UserSelect({ value, onChange, people, label, placeholder = "Unassigned", error, allowClear = true, required, disabled }: {
  value: string | null | undefined; onChange: (id: string | null) => void; people?: Person[]; label?: string; placeholder?: string; error?: string | null; allowClear?: boolean; required?: boolean; disabled?: boolean;
}) {
  const { users, usersById } = useLookup();
  const list = (people ?? users.filter((u) => u.active)).filter((u) => u.active !== false);
  const current = value ? usersById.get(value) ?? list.find((u) => u.id === value) : null;
  return (
    <Field label={label} error={error} required={required}>
      <Popover width="w-64" trigger={({ toggle }) => (
        <button type="button" disabled={disabled} onClick={toggle} className={cn(triggerCls, "disabled:bg-slate-50")} aria-label={label ?? "Select user"}>
          <span className="flex min-w-0 items-center gap-2">
            {current ? <><Avatar name={current.name} src={current.avatar} size={20} /><span className="truncate">{current.name}</span></> : <span className="text-slate-400">{placeholder}</span>}
          </span>
          <ChevronDown className="size-4 shrink-0 text-slate-400" />
        </button>
      )}>
        {(close) => (
          <ul className="max-h-60 overflow-y-auto" role="listbox">
            {allowClear && !required && <li><button type="button" className="w-full rounded px-2 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-50" onClick={() => { onChange(null); close(); }}>{placeholder}</button></li>}
            {list.map((u) => (
              <li key={u.id}>
                <button type="button" role="option" aria-selected={u.id === value} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => { onChange(u.id); close(); }}>
                  <Avatar name={u.name} src={u.avatar} size={20} /><span className="flex-1 truncate">{u.name}</span>{u.id === value && <Check className="size-4 text-indigo-600" />}
                </button>
              </li>
            ))}
            {!list.length && <li className="px-2 py-3 text-center text-xs text-slate-400">No people available</li>}
          </ul>
        )}
      </Popover>
    </Field>
  );
}

/** Choose several users (e.g. contributors / project team). */
export function UserMultiSelect({ value, onChange, people, label, placeholder = "Add people", error, exclude }: {
  value: string[]; onChange: (ids: string[]) => void; people?: Person[]; label?: string; placeholder?: string; error?: string | null; exclude?: (string | null | undefined)[];
}) {
  const { users, usersById } = useLookup();
  const list = (people ?? users).filter((u) => u.active !== false && !exclude?.includes(u.id));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <Field label={label} error={error}>
      <Popover width="w-64" trigger={({ toggle: t }) => (
        <button type="button" onClick={t} className={cn(triggerCls, "min-h-9 h-auto flex-wrap py-1.5")} aria-label={label ?? placeholder}>
          <span className="flex flex-1 flex-wrap items-center gap-1">
            {value.length ? value.map((id) => {
              const u = usersById.get(id);
              return (
                <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-1 pr-1.5 text-xs">
                  <Avatar name={u?.name ?? id} src={u?.avatar} size={16} />{u?.name ?? id}
                  <span role="button" aria-label={`Remove ${u?.name ?? id}`} className="cursor-pointer text-slate-400 hover:text-slate-700" onClick={(e) => { e.stopPropagation(); toggle(id); }}><X className="size-3" /></span>
                </span>
              );
            }) : <span className="text-slate-400">{placeholder}</span>}
          </span>
          <ChevronDown className="size-4 shrink-0 text-slate-400" />
        </button>
      )}>
        {() => (
          <ul className="max-h-60 overflow-y-auto" role="listbox" aria-multiselectable>
            {list.map((u) => (
              <li key={u.id}>
                <button type="button" role="option" aria-selected={value.includes(u.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => toggle(u.id)}>
                  <Avatar name={u.name} src={u.avatar} size={20} /><span className="flex-1 truncate">{u.name}</span>{value.includes(u.id) && <Check className="size-4 text-indigo-600" />}
                </button>
              </li>
            ))}
            {!list.length && <li className="px-2 py-3 text-center text-xs text-slate-400">No people available</li>}
          </ul>
        )}
      </Popover>
    </Field>
  );
}

/** Free-text tags: type and press Enter / comma. */
export function TagInput({ value, onChange, label, placeholder = "Add tag…" }: { value: string[]; onChange: (t: string[]) => void; label?: string; placeholder?: string }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim().replace(/,$/, "");
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setText("");
  };
  return (
    <Field label={label}>
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
            {t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(value.filter((v) => v !== t))} className="text-slate-400 hover:text-slate-700"><X className="size-3" /></button>
          </span>
        ))}
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={label ?? "Tags"}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1)); }}
          onBlur={add} className="min-w-20 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-slate-400" />
      </div>
    </Field>
  );
}
