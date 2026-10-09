import { route } from "@/utils/api";
export const GET = route(({ svc, sp }) =>
  svc.activity.list({ entityType: sp.get("entityType") ?? undefined, entityId: sp.get("entityId") ?? undefined, projectId: sp.get("projectId") ?? undefined, limit: Math.min(300, Number(sp.get("limit")) || 50) }));
