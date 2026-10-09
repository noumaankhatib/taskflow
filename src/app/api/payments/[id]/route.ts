import { noContent, route } from "@/utils/api";
type P = { id: string };
export const GET = route<P>(({ svc, actor, params }) => svc.payments.get(actor, params.id));
export const PUT = route<P>(async ({ svc, actor, params, body }) => svc.payments.update(actor, params.id, await body()));
export const DELETE = route<P>(async ({ svc, actor, params }) => (await svc.payments.softDelete(actor, params.id), noContent()));
