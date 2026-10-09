import { route } from "@/utils/api";
export const POST = route<{ id: string }>(({ svc, actor, params }) => svc.tasks.restore(actor, params.id));
