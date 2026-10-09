import { created, route } from "@/utils/api";
export const POST = route<{ id: string }>(async ({ svc, actor, params, body }) => created(await svc.tasks.addSubtask(actor, params.id, await body())));
