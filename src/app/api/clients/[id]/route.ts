import { route } from "@/utils/api";
type P = { id: string };
export const GET = route<P>(({ svc, params }) => svc.clients.get(params.id));
export const PUT = route<P>(async ({ svc, actor, params, body }) => svc.clients.update(actor, params.id, await body()));
export const DELETE = route<P>(({ svc, actor, params }) => svc.clients.deactivate(actor, params.id));
