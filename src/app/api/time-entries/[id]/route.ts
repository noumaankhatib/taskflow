import { noContent, route } from "@/utils/api";
type P = { id: string };
export const PUT = route<P>(async ({ svc, actor, params, body }) => svc.time.update(actor, params.id, await body()));
export const DELETE = route<P>(async ({ svc, actor, params }) => (await svc.time.remove(actor, params.id), noContent()));
