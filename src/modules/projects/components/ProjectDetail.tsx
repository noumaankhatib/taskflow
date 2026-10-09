"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Archive, BriefcaseBusiness, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge, StatusBadge, Tabs } from "@/components/ui/display";
import { EmptyState, ErrorState, CardsSkeleton, Notice } from "@/components/ui/feedback";
import { useConfirm } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { invalidate, useApi } from "@/lib/hooks";
import { useCan, useLookup } from "@/lib/lookups";
import { HEALTH_LABEL, healthTone, priorityTone, projectStatusTone } from "@/lib/status";
import { formatDate } from "@/utils/format";
import { TaskWorkspace } from "@/modules/tasks/components/TaskWorkspace";
import { ExpensesWorkspace } from "@/modules/expenses/components/ExpensesWorkspace";
import { PaymentsWorkspace } from "@/modules/payments/components/PaymentsWorkspace";
import { OverviewTab } from "./OverviewTab";
import { TeamTab } from "./TeamTab";
import { TimeTab } from "./TimeTab";
import { FilesTab } from "./FilesTab";
import { ActivityTab } from "./ActivityTab";
import { ProjectFormModal } from "./ProjectFormModal";
import type { ProjectView } from "./types";

const TAB_IDS = ["overview", "tasks", "team", "time", "expenses", "payments", "files", "activity"] as const;
type TabId = (typeof TAB_IDS)[number];

export function ProjectDetail({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const { clientName, reload } = useLookup();
  const canWrite = useCan("project:write");
  const canDelete = useCan("project:delete");
  const canFinance = useCan("finance:view");
  const [editing, setEditing] = useState(false);

  // archived projects are only reachable by managers; ask the API for them explicitly when the normal fetch 404s
  const live = useApi<ProjectView>(`/api/projects/${id}`);
  const archivedList = useApi<ProjectView[]>(live.error && (live.error as ApiError).status === 404 ? `/api/projects?deleted=true&pageSize=500` : null);
  const project = live.data ?? archivedList.data?.find((p) => p.id === id);

  const tab = ((t) => (TAB_IDS.includes(t as TabId) ? (t as TabId) : "overview"))(sp.get("tab"));
  const setTab = (t: TabId) => {
    const next = new URLSearchParams(sp.toString());
    if (t === "overview") next.delete("tab"); else next.set("tab", t);
    next.delete("task"); next.delete("expense"); next.delete("payment");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  async function refresh() { await Promise.all([invalidate("/api/projects", "/api/dashboard"), reload()]); }
  async function archive() {
    if (!project) return;
    if (!(await confirm({ title: `Archive ${project.name}?`, message: "The project and its tasks, expenses and payments are hidden. A safety backup is taken first, and you can restore it later.", confirmLabel: "Archive project", destructive: true }))) return;
    try { await api.del(`/api/projects/${id}`); toast.success("Project archived"); await refresh(); router.push("/projects"); } catch (e) { toast.error(e); }
  }
  async function restore() {
    try { await api.post(`/api/projects/${id}/restore`); toast.success("Project restored"); await refresh(); await live.reload(); } catch (e) { toast.error(e); }
  }

  if ((live.isLoading && !project) || (archivedList.isLoading && !project)) return <CardsSkeleton count={3} />;
  if (!project) {
    const notFound = (live.error as ApiError | undefined)?.status === 404;
    return notFound || !live.error ? (
      <EmptyState icon={<BriefcaseBusiness className="size-5" />} title="Project not found" description="It may have been archived or you may not have access to it."
        action={<Link href="/projects"><Button variant="outline">Back to projects</Button></Link>} />
    ) : <ErrorState error={live.error} onRetry={live.reload} />;
  }

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "tasks" as const, label: "Tasks", count: project.taskStats.total },
    { id: "team" as const, label: "Team", count: project.memberIds.length },
    { id: "time" as const, label: "Time" },
    { id: "expenses" as const, label: "Expenses" },
    ...(canFinance ? [{ id: "payments" as const, label: "Payments" }] : []),
    { id: "files" as const, label: "Files" },
    { id: "activity" as const, label: "Activity" },
  ];

  return (
    <>
      <div className="mb-4">
        <Link href="/projects" className="mb-1 inline-block text-xs font-medium text-slate-500 hover:text-indigo-600">← Projects</Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{project.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="font-mono text-xs">{project.id}</span><span>·</span>
              <Link href={`/clients?client=${project.clientId}`} className="font-medium text-slate-700 hover:text-indigo-600">{clientName(project.clientId)}</Link>
              <StatusBadge value={project.status} tones={projectStatusTone} />
              <StatusBadge value={project.priority} tones={priorityTone} />
              {project.status !== "CANCELLED" && <StatusBadge value={project.health} tones={healthTone} text={HEALTH_LABEL[project.health]} />}
              {project.isDeleted && <Badge tone="zinc">Archived</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            {canWrite && !project.isDeleted && <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Edit</Button>}
            {canDelete && !project.isDeleted && <Button variant="outline" icon={<Archive className="size-4" />} onClick={archive} className="text-rose-600">Archive</Button>}
          </div>
        </div>
      </div>

      {project.isDeleted && (
        <Notice tone="warn" className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span>This project was archived{project.deletedAt ? ` on ${formatDate(project.deletedAt)}` : ""}. Its data is hidden from other screens.</span>
          {canDelete && <Button size="sm" variant="outline" icon={<RotateCcw className="size-3.5" />} onClick={restore}>Restore</Button>}
        </Notice>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-5" />

      {tab === "overview" && <OverviewTab project={project} />}
      {tab === "tasks" && <TaskWorkspace projectId={id} />}
      {tab === "team" && <TeamTab project={project} onChanged={async () => { await live.reload(); await refresh(); }} />}
      {tab === "time" && <TimeTab project={project} />}
      {tab === "expenses" && <ExpensesWorkspace projectId={id} />}
      {tab === "payments" && canFinance && <PaymentsWorkspace projectId={id} />}
      {tab === "files" && <FilesTab project={project} />}
      {tab === "activity" && <ActivityTab projectId={id} />}

      <ProjectFormModal open={editing} project={project} onClose={() => setEditing(false)} onSaved={() => live.reload()} />
    </>
  );
}
