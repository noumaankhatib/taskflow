"use client";
import type { Activity } from "@/schemas/entities";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { Card } from "@/components/ui/display";
import { ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { useApi } from "@/lib/hooks";

export function ActivityTab({ projectId }: { projectId: string }) {
  const { data, error, isLoading, reload } = useApi<Activity[]>(`/api/projects/${projectId}/activity?limit=150`);
  return (
    <Card>
      {isLoading && !data ? <TableSkeleton rows={5} cols={2} /> : error ? <ErrorState error={error} onRetry={reload} /> : <ActivityTimeline items={data ?? []} emptyText="Changes to this project, its tasks, expenses and payments will appear here." />}
    </Card>
  );
}
