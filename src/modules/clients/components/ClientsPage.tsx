"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Building2, Pencil, Plus, Power, PowerOff } from "lucide-react";
import type { Client } from "@/schemas/entities";
import { Button } from "@/components/ui/Button";
import { Badge, Card, PageHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { SearchInput, Select } from "@/components/ui/form";
import { Menu } from "@/components/ui/menu";
import { useConfirm } from "@/components/ui/overlay";
import { Pagination, SortTh, TableWrap, THead, Td, Th, Tr } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { invalidate, useApi, useAsyncAction, useDebounced } from "@/lib/hooks";
import { useCan, useLookup } from "@/lib/lookups";
import { formatMoney } from "@/utils/format";
import { ClientModal } from "./ClientModal";
import { ClientDrawer } from "./ClientDrawer";

type Row = Client & { projectCount: number; activeProjectCount: number; totalContractValue: number };

export function ClientsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const lookup = useLookup();
  const canWrite = useCan("client:write");
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const [sort, setSort] = useState("companyName:asc");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const dq = useDebounced(q);
  const { data, meta, error, isLoading, reload } = useApi<Row[]>(`/api/clients?page=${page}&pageSize=20&sort=${sort}&q=${encodeURIComponent(dq)}${active ? `&active=${active}` : ""}`);
  const [setActiveState] = useAsyncAction(async (c: Client, on: boolean) => {
    await api.put(`/api/clients/${c.id}`, { active: on });
    toast.success(`${c.companyName} ${on ? "reactivated" : "deactivated"}`);
    await invalidate("/api/clients");
    lookup.reload();
  }, toast.error);

  const deactivate = async (c: Client) => {
    if (await confirm({ title: `Deactivate ${c.companyName}?`, message: "They won't be selectable for new projects. Existing projects and history are kept.", confirmLabel: "Deactivate", destructive: true })) setActiveState(c, false);
  };
  const menu = (c: Row) => [
    { label: "Edit", icon: <Pencil className="size-4" />, onSelect: () => setEditing(c) },
    c.active ? { label: "Deactivate", icon: <PowerOff className="size-4" />, onSelect: () => deactivate(c), danger: true } : { label: "Reactivate", icon: <Power className="size-4" />, onSelect: () => setActiveState(c, true) },
  ];
  const open = (c: Client) => router.push(`/clients?client=${c.id}`, { scroll: false });
  const onSort = (s: string) => { setSort(s); setPage(1); };
  const filtered = !!(q || active);

  return (
    <>
      <PageHeader title="Clients" description="Companies you work for, and the projects tied to them."
        actions={canWrite && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Add client</Button>} />
      <Card padded={false}>
        <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row sm:items-center">
          <SearchInput className="sm:w-72" placeholder="Search company, contact or email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search clients" />
          <Select aria-label="Filter by status" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} className="sm:w-40"><option value="">Any status</option><option value="true">Active</option><option value="false">Inactive</option></Select>
        </div>
        {error ? <ErrorState error={error} onRetry={reload} /> : isLoading && !data ? <TableSkeleton cols={6} /> : !data?.length ? (
          <EmptyState icon={<Building2 className="size-5" />} title={filtered ? "No clients match" : "No clients yet"} description={filtered ? "Try adjusting your search or filter." : "Add your first client to start creating projects."}
            action={canWrite && !filtered ? <Button size="sm" onClick={() => setCreating(true)}>Add client</Button> : undefined} />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {data.map((c) => (
                <li key={c.id} className="flex items-center gap-3 p-3" onClick={() => open(c)}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{c.companyName}</p>
                    <p className="truncate text-xs text-slate-500">{c.contactPerson || c.email || "—"}</p>
                    <p className="mt-1 text-xs text-slate-500">{c.projectCount} projects · {formatMoney(c.totalContractValue)}</p>
                  </div>
                  <Badge tone={c.active ? "emerald" : "zinc"} dot>{c.active ? "Active" : "Inactive"}</Badge>
                  {canWrite && <Menu items={menu(c)} />}
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <TableWrap>
                <THead><tr>
                  <SortTh label="Company" field="companyName" sort={sort} onSort={onSort} /><Th>Contact</Th><Th>Phone</Th>
                  <SortTh label="Projects" field="projectCount" sort={sort} onSort={onSort} className="text-right" /><Th className="text-right">Contract value</Th><Th>Status</Th>{canWrite && <Th className="w-10"><span className="sr-only">Actions</span></Th>}
                </tr></THead>
                <tbody>
                  {data.map((c) => (
                    <Tr key={c.id} onClick={() => open(c)}>
                      <Td><p className="font-medium text-slate-900">{c.companyName}</p><p className="text-xs text-slate-500">{c.email || "—"}</p></Td>
                      <Td>{c.contactPerson || "—"}</Td><Td className="whitespace-nowrap">{c.phone || "—"}</Td>
                      <Td className="text-right tabular-nums">{c.projectCount}{c.activeProjectCount > 0 && <span className="text-xs text-slate-400"> ({c.activeProjectCount} active)</span>}</Td>
                      <Td className="text-right tabular-nums">{formatMoney(c.totalContractValue)}</Td>
                      <Td><Badge tone={c.active ? "emerald" : "zinc"} dot>{c.active ? "Active" : "Inactive"}</Badge></Td>
                      {canWrite && <Td className="text-right"><Menu items={menu(c)} /></Td>}
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPage={setPage} />}
          </>
        )}
      </Card>
      <ClientModal open={creating || !!editing} client={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      <ClientDrawer clientId={sp.get("client")} onClose={() => router.replace("/clients", { scroll: false })} />
    </>
  );
}
