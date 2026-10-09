import { noContent, route } from "@/utils/api";
type P = { id: string; commentId: string };
export const PUT = route<P>(async ({ svc, actor, params, body }) => svc.tasks.updateComment(actor, params.id, params.commentId, await body()));
export const DELETE = route<P>(async ({ svc, actor, params }) => (await svc.tasks.deleteComment(actor, params.id, params.commentId), noContent()));
