import { route } from "@/utils/api";
export const GET = route<{ id: string }>(async ({ svc, actor, params, sp }) => {
  await svc.projects.get(actor, params.id, true);
  return svc.activity.list({ projectId: params.id, limit: Math.min(300, Number(sp.get("limit")) || 100) });
});
