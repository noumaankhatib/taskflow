import { route } from "@/utils/api";
export const GET = route<{ id: string }>(({ svc, actor, params }) => svc.reports.project(actor, params.id));
