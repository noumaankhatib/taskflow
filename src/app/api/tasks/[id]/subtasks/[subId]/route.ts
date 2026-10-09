import { noContent, route } from "@/utils/api";
type P = { id: string; subId: string };
export const PUT = route<P>(async ({ svc, actor, params, body }) => svc.tasks.updateSubtask(actor, params.id, params.subId, await body()));
export const DELETE = route<P>(async ({ svc, actor, params }) => (await svc.tasks.deleteSubtask(actor, params.id, params.subId), noContent()));
