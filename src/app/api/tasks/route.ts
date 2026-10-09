import { created, paged, route } from "@/utils/api";
import { paginate, parsePageQuery } from "@/utils/query";
import { taskFilterFromParams } from "@/modules/tasks/task.service";

export const GET = route(async ({ svc, actor, sp }) => {
  const f = taskFilterFromParams(sp);
  if (sp.get("mine") === "true") f.assigneeId = actor.id;
  const rows = await svc.tasks.list(f);
  return paged(paginate(rows, parsePageQuery(sp, { pageSize: 100 }), ["title", "status", "priority", "dueDate", "updatedAt", "createdAt", "estimatedHours", "actualHours"]));
});
export const POST = route(async ({ svc, actor, body }) => created(await svc.tasks.create(actor, await body())));
