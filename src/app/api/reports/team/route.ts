import { route } from "@/utils/api";
export const GET = route(({ svc, actor, sp }) => svc.reports.team(actor, { from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined }));
