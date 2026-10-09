import { noContent, route } from "@/utils/api";
type P = { id: string };
export const GET = route<P>(({ svc, params }) => svc.tasks.get(params.id));
export const PUT = route<P>(async ({ svc, actor, params, body }) => svc.tasks.update(actor, params.id, await body()));
export const DELETE = route<P>(async ({ svc, actor, params }) => (await svc.tasks.softDelete(actor, params.id), noContent()));
