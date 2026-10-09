import { route } from "@/utils/api";
export const GET = route(({ svc, actor, sp }) =>
  svc.reports.expenses(actor, { from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined, projectId: sp.get("projectId") ?? undefined }));
