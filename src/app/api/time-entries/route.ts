import { created, route } from "@/utils/api";
export const GET = route(({ svc, sp }) =>
  svc.time.list({
    taskId: sp.get("taskId") ?? undefined, projectId: sp.get("projectId") ?? undefined, userId: sp.get("userId") ?? undefined,
    from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined,
  }));
export const POST = route(async ({ svc, actor, body }) => created(await svc.time.create(actor, await body())));
