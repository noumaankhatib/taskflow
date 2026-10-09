import { route } from "@/utils/api";
export const GET = route<{ id: string }>(async ({ svc, params }) => {
  const t = await svc.tasks.get(params.id, true);
  const subs = new Set(t.subtasks.map((s) => s.id));
  const rows = await svc.activity.list({ projectId: t.projectId, limit: 1000 });
  return rows.filter((a) => a.entityId === params.id || subs.has(a.entityId) || (a.entityType === "COMMENT" && (a.newValue as { taskId?: string } | null)?.taskId === params.id)).slice(0, 100);
});
