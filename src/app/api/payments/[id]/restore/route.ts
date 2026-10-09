import { route } from "@/utils/api";
export const POST = route<{ id: string }>(({ svc, actor, params }) => svc.payments.restore(actor, params.id));
