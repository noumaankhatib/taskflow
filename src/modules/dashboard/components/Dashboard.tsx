"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, CircleDollarSign, ListChecks, Percent, Wallet } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader, ProgressBar, StatCard, StatusBadge, AvatarStack, Avatar } from "@/components/ui/display";
import { CardsSkeleton, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { cn } from "@/components/ui/cn";
import { useApi } from "@/lib/hooks";
import { useLookup, useMe } from "@/lib/lookups";
import { HEALTH_LABEL, healthTone, paymentStatusTone, priorityTone, taskStatusTone } from "@/lib/status";
import { formatDate, formatMoney, formatPct, label } from "@/utils/format";
import type { Expense } from "@/schemas/entities";
import type { TaskView } from "@/modules/tasks/task.service";
import type { PaymentView } from "@/modules/payments/payment.service";
import { IssueRow } from "@/modules/tasks/components/OpenIssues";
import { TaskDrawer } from "@/modules/tasks/components/TaskDrawer";

interface DashboardData {
  openIssues: TaskView[];
  projects: { total: number; active: number; completed: number; atRisk: number };
  tasks: { backlog: number; todo: number; inProgress: number; blocked: number; review: number; completed: number; overdue: number; total: number };
  financials: null | { contractValue: number; received: number; pending: number; teamCost: number; otherExpenses: number; totalCost: number; netProfit: number; profitMargin: number };
  projectProgress: { id: string; name: string; progress: number; health: string; status: string; taskStats: { total: number; done: number; overdue: number; openIssues: number; urgentIssues: number }; expectedEndDate: string | null }[];
  myTasks: TaskView[];
  recentTasks: TaskView[];
  recentExpenses: (Expense & { projectName: string })[];
  pendingPayments: (PaymentView & { projectName: string })[];
  upcomingDeadlines: { type: "task" | "project"; id: string; title: string; date: string; projectName: string; priority: string; href: string }[];
  teamWorkload: { userId: string; name: string; role: string; avatar: string | null; openTasks: number; overdueTasks: number; remainingHours: number; utilization: number }[];
}

export function Dashboard() {
  const me = useMe();
  const { data, error, isLoading, reload } = useApi<DashboardData>("/api/dashboard");
  const [taskId, setTaskId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome back, ${me.name.split(" ")[0]}`} description="Here's what's happening across your projects." />
      {isLoading && !data ? <DashboardSkeleton /> : error && !data ? <Card><ErrorState error={error} onRetry={reload} /></Card> : data ? <Body d={data} openTask={setTaskId} /> : null}
      <TaskDrawer taskId={taskId} onClose={() => setTaskId(null)} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <CardsSkeleton count={4} />
      <CardsSkeleton count={4} />
      <div className="grid gap-4 lg:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>
    </div>
  );
}

function Section({ title, description, action, children, className }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <Card className={className}><CardHeader title={title} description={description} action={action} />{children}</Card>;
}

function Body({ d, openTask }: { d: DashboardData; openTask: (id: string) => void }) {
  const { projectName } = useLookup();
  const f = d.financials;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active projects" value={d.projects.active} icon={<BriefcaseBusiness className="size-4" />} href="/projects?status=ACTIVE" />
        <StatCard label="Completed projects" value={d.projects.completed} icon={<CheckCircle2 className="size-4" />} href="/projects?status=COMPLETED" />
        <StatCard label="At risk" value={d.projects.atRisk} tone={d.projects.atRisk ? "warn" : undefined} icon={<AlertTriangle className="size-4" />} hint="Delayed or many overdue tasks" />
        <StatCard label="Total projects" value={d.projects.total} href="/projects" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Todo" value={d.tasks.todo} />
        <StatCard label="In progress" value={d.tasks.inProgress} />
        <StatCard label="Review" value={d.tasks.review} />
        <StatCard label="Completed" value={d.tasks.completed} tone="good" />
        <StatCard label="Blocked" value={d.tasks.blocked} tone={d.tasks.blocked ? "warn" : undefined} />
        <StatCard label="Overdue" value={d.tasks.overdue} tone={d.tasks.overdue ? "bad" : undefined} icon={<ListChecks className="size-4" />} />
      </div>

      {f && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <StatCard label="Project revenue" value={formatMoney(f.contractValue)} hint="Contract value" icon={<CircleDollarSign className="size-4" />} />
          <StatCard label="Received" value={formatMoney(f.received)} tone="good" />
          <StatCard label="Pending" value={formatMoney(f.pending)} tone={f.pending ? "warn" : undefined} />
          <StatCard label="Expenses" value={formatMoney(f.otherExpenses)} />
          <StatCard label="Team cost" value={formatMoney(f.teamCost)} />
          <StatCard label="Net profit" value={formatMoney(f.netProfit)} tone={f.netProfit >= 0 ? "good" : "bad"} icon={<Wallet className="size-4" />} hint="Revenue − team − expenses" />
          <StatCard label="Profit margin" value={formatPct(f.profitMargin)} tone={f.profitMargin >= 0 ? "good" : "bad"} icon={<Percent className="size-4" />} />
        </div>
      )}

      <OpenIssuesSection issues={d.openIssues} onOpen={openTask} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Project progress" action={<Link href="/projects" className="text-xs font-medium text-indigo-600 hover:underline">All projects</Link>}>
          {d.projectProgress.length ? (
            <ul className="space-y-4">
              {d.projectProgress.map((p) => (
                <li key={p.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <Link href={`/projects/${p.id}`} className="min-w-0 truncate text-sm font-medium text-slate-800 hover:text-indigo-600">{p.name}</Link>
                    <span className="flex shrink-0 items-center gap-2"><Badge tone={healthTone[p.health] ?? "slate"} dot>{HEALTH_LABEL[p.health] ?? p.health}</Badge><span className="w-9 text-right text-xs tabular-nums text-slate-500">{p.progress}%</span></span>
                  </div>
                  <ProgressBar value={p.progress} tone={p.health === "DELAYED" ? "rose" : p.health === "AT_RISK" ? "amber" : "indigo"} label={`${p.name} progress`} />
                  <p className="mt-1 text-xs text-slate-400">{p.taskStats.done}/{p.taskStats.total} tasks{p.taskStats.overdue ? ` · ${p.taskStats.overdue} overdue` : ""}{p.expectedEndDate ? ` · due ${formatDate(p.expectedEndDate)}` : ""}</p>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No active projects" description="Active and planning projects show up here." />}
        </Section>

        <Section title="My tasks" description="Open tasks assigned to you" action={<Link href="/tasks" className="text-xs font-medium text-indigo-600 hover:underline">View all</Link>}>
          <TaskRows tasks={d.myTasks} onOpen={openTask} projectName={projectName} empty="Nothing assigned to you right now." />
        </Section>

        <Section title="Upcoming deadlines" description="Next 14 days">
          {d.upcomingDeadlines.length ? (
            <ul className="divide-y divide-slate-100">
              {d.upcomingDeadlines.map((x) => (
                <li key={x.type + x.id}>
                  <DeadlineRow x={x} onOpen={openTask} />
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No deadlines coming up" description="Nothing is due in the next two weeks." />}
        </Section>

        <Section title="Team workload" description="Remaining estimated hours vs 80h capacity">
          {d.teamWorkload.length ? (
            <ul className="space-y-3">
              {d.teamWorkload.map((w) => <WorkloadRow key={w.userId} w={w} />)}
            </ul>
          ) : <EmptyState title="No team members" />}
        </Section>

        <Section title="Recently updated tasks">
          <TaskRows tasks={d.recentTasks} onOpen={openTask} projectName={projectName} empty="No task activity yet." showStatus />
        </Section>

        <Section title="Recent expenses" action={<Link href="/expenses" className="text-xs font-medium text-indigo-600 hover:underline">All expenses</Link>}>
          {d.recentExpenses.length ? (
            <ul className="divide-y divide-slate-100">
              {d.recentExpenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{e.description}</p><p className="truncate text-xs text-slate-500">{e.projectName} · {label(e.category)} · {formatDate(e.date)}</p></div>
                  <div className="shrink-0 text-right"><p className="text-sm font-semibold tabular-nums">{formatMoney(e.amount, e.currency)}</p>{e.approvalStatus === "PENDING" && <Badge tone="amber">Pending</Badge>}</div>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No expenses yet" />}
        </Section>

        {f && (
          <Section title="Pending payments" className="lg:col-span-2" action={<Link href="/payments" className="text-xs font-medium text-indigo-600 hover:underline">All payments</Link>}>
            {d.pendingPayments.length ? (
              <ul className="divide-y divide-slate-100">
                {d.pendingPayments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{p.invoiceNumber} <span className="font-normal text-slate-500">· {p.projectName}</span></p><p className="text-xs text-slate-500">Due {formatDate(p.dueDate)}</p></div>
                    <div className="flex items-center gap-3"><StatusBadge value={p.effectiveStatus} tones={paymentStatusTone} /><span className="w-24 text-right text-sm font-semibold tabular-nums">{formatMoney(p.outstanding, p.currency)}</span></div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="All caught up" description="No outstanding invoices." />}
          </Section>
        )}
      </div>
    </>
  );
}

function TaskRows({ tasks, onOpen, projectName, empty, showStatus }: { tasks: TaskView[]; onOpen: (id: string) => void; projectName: (id: string) => string; empty: string; showStatus?: boolean }) {
  const { usersById } = useLookup();
  if (!tasks.length) return <EmptyState title={empty} />;
  return (
    <ul className="-mx-2 divide-y divide-slate-100">
      {tasks.map((t) => {
        const people = [t.primaryOwnerId, ...t.contributorIds].filter(Boolean).map((id) => ({ id: id!, name: usersById.get(id!)?.name ?? id!, avatar: usersById.get(id!)?.avatar }));
        return (
          <li key={t.id}>
            <button onClick={() => onOpen(t.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{t.title}</p>
                <p className="truncate text-xs text-slate-500">{projectName(t.projectId)}{t.dueDate && <span className={cn(t.isOverdue && "font-medium text-rose-600")}> · {t.isOverdue ? "Overdue " : "Due "}{formatDate(t.dueDate)}</span>}</p>
              </div>
              {showStatus ? <StatusBadge value={t.status} tones={taskStatusTone} /> : <Badge tone={priorityTone[t.priority]}>{label(t.priority)}</Badge>}
              <span className="hidden sm:block"><AvatarStack people={people} max={3} size={22} /></span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DeadlineRow({ x, onOpen }: { x: DashboardData["upcomingDeadlines"][number]; onOpen: (id: string) => void }) {
  const inner = (
    <>
      <div className="w-12 shrink-0 rounded-lg bg-slate-100 py-1 text-center"><p className="text-[10px] font-medium uppercase text-slate-500">{new Date(x.date + "T00:00:00").toLocaleDateString("en-IN", { month: "short" })}</p><p className="text-base font-semibold leading-tight text-slate-800">{x.date.slice(8)}</p></div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{x.title}</p><p className="truncate text-xs text-slate-500">{x.type === "project" ? "Project deadline" : x.projectName}</p></div>
      <Badge tone={priorityTone[x.priority]}>{label(x.priority)}</Badge>
    </>
  );
  const cls = "flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50";
  return x.type === "task" ? <button className={cls} onClick={() => onOpen(x.id)}>{inner}</button> : <Link className={cls} href={x.href}>{inner}</Link>;
}

function WorkloadRow({ w }: { w: DashboardData["teamWorkload"][number] }) {
  const tone = w.utilization > 100 ? "rose" : w.utilization >= 80 ? "amber" : "indigo";
  const blocks = 10;
  const filled = Math.min(blocks, Math.round((Math.min(w.utilization, 100) / 100) * blocks));
  return (
    <li className="flex items-center gap-3">
      <Avatar name={w.name} src={w.avatar} size={28} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-sm"><span className="truncate font-medium text-slate-800">{w.name}</span><span className="shrink-0 text-xs tabular-nums text-slate-500">{w.utilization}%</span></div>
        <ProgressBar value={w.utilization} tone={tone} label={`${w.name} workload`} className="my-1" />
        <p className="text-xs text-slate-400"><span aria-hidden className="mr-1.5 font-mono tracking-tighter text-slate-300">{"█".repeat(filled)}{"░".repeat(blocks - filled)}</span>{w.openTasks} open · {w.remainingHours}h left{w.overdueTasks ? <span className="text-rose-600"> · {w.overdueTasks} overdue</span> : ""}</p>
      </div>
    </li>
  );
}

/** Open bugs & issues, grouped by project, each row showing who it is assigned to. Urgent ones are highlighted. */
function OpenIssuesSection({ issues, onOpen }: { issues: TaskView[]; onOpen: (id: string) => void }) {
  const { projectName, userName } = useLookup();
  const urgent = issues.filter((t) => t.isUrgentIssue).length;
  const groups = new Map<string, TaskView[]>();
  for (const t of issues) (groups.get(t.projectId) ?? groups.set(t.projectId, []).get(t.projectId)!).push(t);
  const unassigned = issues.filter((t) => !t.primaryOwnerId).length;
  const byPerson = new Map<string, number>();
  for (const t of issues) if (t.primaryOwnerId) byPerson.set(t.primaryOwnerId, (byPerson.get(t.primaryOwnerId) ?? 0) + 1);
  return (
    <Section title="Open issues" description={issues.length ? `${issues.length} open${urgent ? ` · ${urgent} overdue, blocked or critical` : ""}` : undefined}
      action={<Link href="/tasks?type=BUG,ISSUE" className="text-xs font-medium text-indigo-600 hover:underline">View all</Link>}>
      {issues.length ? (
        <>
          <p className="mb-3 flex flex-wrap gap-1.5 text-xs">
            {[...byPerson].sort((a, b) => b[1] - a[1]).map(([id, n]) => <Badge key={id} tone="slate">{userName(id)} · {n}</Badge>)}
            {unassigned > 0 && <Badge tone="amber">Unassigned · {unassigned}</Badge>}
          </p>
          <div className="space-y-4">
            {[...groups].map(([pid, rows]) => (
              <div key={pid}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{projectName(pid)} <span className="font-normal normal-case">· {rows.length}</span></p>
                <ul className="-mx-3 space-y-0.5">{rows.slice(0, 5).map((t) => <IssueRow key={t.id} t={t} onOpen={onOpen} />)}</ul>
                {rows.length > 5 && <p className="mt-1 text-xs text-slate-400">+{rows.length - 5} more in this project</p>}
              </div>
            ))}
          </div>
        </>
      ) : <EmptyState title="No open issues" description="Tasks of type Bug or Issue that are not completed show up here." />}
    </Section>
  );
}
