import { noContent, route } from "@/utils/api";
type P = { id: string };
export const GET = route<P>(({ svc, actor, params }) => svc.projects.get(actor, params.id));
export const PUT = route<P>(async ({ svc, actor, params, body }) => svc.projects.update(actor, params.id, await body()));
export const DELETE = route<P>(async ({ svc, actor, params }) => (await svc.projects.softDelete(actor, params.id), noContent()));
