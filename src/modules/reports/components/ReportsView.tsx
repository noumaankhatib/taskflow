"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import { Card, PageHeader, Tabs } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { useCan } from "@/lib/lookups";
import { ProjectReport } from "./ProjectReport";
import { TeamReport } from "./TeamReport";
import { ExpenseReport } from "./ExpenseReport";

type Tab = "project" | "team" | "expenses";

export function ReportsView() {
  const allowed = useCan("report:view");
  const [tab, setTab] = useState<Tab>("project");
  if (!allowed) return (
    <div className="space-y-4"><PageHeader title="Reports" /><Card><EmptyState icon={<Lock className="size-5" />} title="Reports are restricted" description="Your role doesn't have access to reports. Ask an admin or project manager if you need them." /></Card></div>
  );
  return (
    <div className="space-y-5">
      <PageHeader title="Reports" description="Profitability, team utilisation and spend." />
      <Tabs className="mb-1" value={tab} onChange={setTab} tabs={[{ id: "project", label: "Project" }, { id: "team", label: "Team" }, { id: "expenses", label: "Expenses" }]} />
      {tab === "project" && <ProjectReport />}
      {tab === "team" && <TeamReport />}
      {tab === "expenses" && <ExpenseReport />}
    </div>
  );
}
