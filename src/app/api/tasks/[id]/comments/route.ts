import { created, route } from "@/utils/api";
type P = { id: string };
export const GET = route<P>(({ svc, params }) => svc.tasks.comments(params.id));
export const POST = route<P>(async ({ svc, actor, params, body }) => created(await svc.tasks.addComment(actor, params.id, await body())));
