"use client";
import { useState } from "react";
import { PageHeader, Segmented } from "@/components/ui/display";
import { TaskWorkspace } from "./TaskWorkspace";

export function MyTasksPage() {
  const [scope, setScope] = useState<"mine" | "all">("mine");
  return (
    <>
      <PageHeader title={scope === "mine" ? "My Tasks" : "All Tasks"}
        description={scope === "mine" ? "Everything assigned to you, across projects." : "Every task across all projects."}
        actions={<Segmented value={scope} onChange={setScope} options={[{ id: "mine", label: "Mine" }, { id: "all", label: "Everyone's" }]} />} />
      <TaskWorkspace key={scope} mineOnly={scope === "mine"} />
    </>
  );
}
