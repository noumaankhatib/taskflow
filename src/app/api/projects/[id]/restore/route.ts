import { route } from "@/utils/api";
export const POST = route<{ id: string }>(({ svc, actor, params }) => svc.projects.restore(actor, params.id));
