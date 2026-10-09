"use client";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Columns3, List, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Select, SearchInput, enumOptions } from "@/components/ui/form";
import { Segmented } from "@/components/ui/display";
import { CardsSkeleton, EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { qs } from "@/lib/api";
import { useApi, useDebounced } from "@/lib/hooks";
import { useCan, useLookup } from "@/lib/lookups";
import { PRIORITIES } from "@/schemas/common";
import { TASK_STATUSES } from "@/schemas/entities";
import { label } from "@/utils/format";
import { TaskBoard } from "./TaskBoard";
import { TaskDrawer } from "./TaskDrawer";
import { TaskFormModal } from "./TaskFormModal";
import { TaskList } from "./TaskList";
import type { TaskView } from "./shared";

type View = "board" | "list";
const PAGE_SIZE = 20;
const dayStr = (offset = 0) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10);

export function TaskWorkspace(props: { projectId?: string; mineOnly?: boolean }) {
  return <Suspense fallback={<CardsSkeleton count={3} />}><Workspace {...props} /></Suspense>;
}

function Workspace({ projectId, mineOnly }: { projectId?: string; mineOnly?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const canCreate = useCan("task:write");
  const manage = useCan("task:manage");
  const { users, projects } = useLookup();

  const [view, setViewState] = useState<View>("board");
  useEffect(() => { const v = localStorage.getItem("tf.taskView"); if (v === "board" || v === "list") setViewState(v); }, []);
  const setView = (v: View) => { setViewState(v); localStorage.setItem("tf.taskView", v); setPage(1); };

  const [q, setQ] = useState("");
  const [project, setProject] = useState("");
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [due, setDue] = useState("");
  const [tag, setTag] = useState("");
  const [deleted, setDeleted] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [sort, setSort] = useState("dueDate:asc");
  const [page, setPage] = useState(1);
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const dq = useDebounced(q.trim());
  const dtag = useDebounced(tag.trim());

  const taskId = sp.get("task");
  const setTaskParam = (id: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (id) p.set("task", id); else p.delete("task");
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  };

  const filterCount = [q, project, assignee, status, priority, due, tag].filter(Boolean).length + (deleted ? 1 : 0);
  const clear = () => { setQ(""); setProject(""); setAssignee(""); setStatus(""); setPriority(""); setDue(""); setTag(""); setDeleted(false); setPage(1); };
  useEffect(() => setPage(1), [dq, project, assignee, status, priority, due, dtag, deleted, mineOnly]);

  const dueParams = due === "overdue" ? { overdue: true } : due === "today" ? { dueFrom: dayStr(), dueTo: dayStr() } : due === "week" ? { dueFrom: dayStr(), dueTo: dayStr(7) } : {};
  const effView: View = deleted ? "list" : view;
  const url = `/api/tasks${qs({
    projectId: projectId ?? project, assigneeId: mineOnly ? undefined : assignee, mine: mineOnly ? true : undefined,
    status, priority, q: dq, tags: dtag, deleted: deleted || undefined, ...dueParams,
    pageSize: effView === "board" ? 500 : PAGE_SIZE, page: effView === "board" ? 1 : page, sort: effView === "board" ? undefined : sort,
  })}`;
  const { data, meta, error, isLoading, reload } = useApi<TaskView[]>(url);
  const tasks = data ?? [];
  const extraCount = tasks.filter((t) => t.status === "BLOCKED" || t.status === "CANCELLED").length;

  const newBtn = canCreate && <Button icon={<Plus className="size-4" />} onClick={() => setCreateStatus("TODO")}>New task</Button>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput aria-label="Search tasks" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-56" />
        {!projectId && <Select aria-label="Project" value={project} onChange={(e) => setProject(e.target.value)} className="!w-auto max-w-44"><option value="">All projects</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}
        {!mineOnly && <Select aria-label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} className="!w-auto max-w-40"><option value="">Anyone</option>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>}
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto"><option value="">Any status</option>{enumOptions(TASK_STATUSES, label)}</Select>
        <Select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="!w-auto"><option value="">Any priority</option>{enumOptions(PRIORITIES, label)}</Select>
        <Select aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} className="!w-auto"><option value="">Any due date</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="week">Next 7 days</option></Select>
        <SearchInput aria-label="Filter by tag" placeholder="Tag" value={tag} onChange={(e) => setTag(e.target.value)} className="w-28" />
        {filterCount > 0 && <Button variant="ghost" size="sm" icon={<X className="size-3.5" />} onClick={clear}>Clear ({filterCount})</Button>}
        <div className="ml-auto flex items-center gap-2">
          {manage && <Checkbox label="Deleted" checked={deleted} onChange={(e) => setDeleted(e.target.checked)} />}
          <Segmented<View> value={effView} onChange={setView} options={[{ id: "board", label: "Board", icon: <Columns3 className="size-4" /> }, { id: "list", label: "List", icon: <List className="size-4" /> }]} />
          {newBtn}
        </div>
      </div>

      {effView === "board" && (extraCount > 0 || showExtra) && (
        <div><Checkbox label={`Show blocked & cancelled (${extraCount})`} checked={showExtra} onChange={(e) => setShowExtra(e.target.checked)} /></div>
      )}

      {error ? <ErrorState error={error} onRetry={reload} />
        : isLoading && !data ? (effView === "board" ? <CardsSkeleton count={4} /> : <div className="rounded-xl border border-slate-200 bg-white"><TableSkeleton /></div>)
        : !tasks.length ? (
          <div className="rounded-xl border border-slate-200 bg-white"><EmptyState title={filterCount ? "No tasks match your filters" : deleted ? "No deleted tasks" : mineOnly ? "Nothing assigned to you" : "No tasks yet"}
            description={filterCount ? "Try removing a filter." : mineOnly ? "Tasks assigned to you will show up here." : "Create the first task to get started."}
            action={filterCount ? <Button variant="outline" onClick={clear}>Clear filters</Button> : newBtn || undefined} /></div>
        ) : effView === "board" ? (
          <TaskBoard tasks={tasks} showExtra={showExtra} onOpen={setTaskParam} onCreate={canCreate ? setCreateStatus : undefined} />
        ) : (
          <TaskList tasks={tasks} onOpen={setTaskParam} sort={sort} onSort={(s) => { setSort(s); setPage(1); }} deletedMode={deleted}
            page={meta?.page ?? 1} totalPages={meta?.totalPages ?? 1} total={meta?.total ?? tasks.length} pageSize={PAGE_SIZE} onPage={setPage} />
        )}

      <TaskDrawer taskId={taskId} onClose={() => setTaskParam(null)} />
      <TaskFormModal open={!!createStatus} onClose={() => setCreateStatus(null)} projectId={projectId} defaultStatus={createStatus ?? undefined} onSaved={(t) => setTaskParam(t.id)} />
    </div>
  );
}
