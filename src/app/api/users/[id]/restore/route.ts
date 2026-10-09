import { route } from "@/utils/api";
export const POST = route<{ id: string }>(({ svc, actor, params }) => svc.users.restore(actor, params.id));
