import { created, paged, route } from "@/utils/api";
import { csv, paginate, parsePageQuery } from "@/utils/query";

export const GET = route(async ({ svc, actor, sp }) => {
  const rows = await svc.projects.list(actor, {
    q: sp.get("q") ?? undefined, status: csv(sp.get("status")), priority: csv(sp.get("priority")),
    clientId: sp.get("clientId") ?? undefined, memberId: sp.get("memberId") ?? undefined, managerId: sp.get("managerId") ?? undefined,
    onlyDeleted: sp.get("deleted") === "true",
  });
  return paged(paginate(rows, parsePageQuery(sp, { pageSize: 50, sort: "updatedAt:desc" }), ["name", "status", "priority", "startDate", "expectedEndDate", "contractValue", "progress", "updatedAt", "createdAt"]));
});
export const POST = route(async ({ svc, actor, body }) => created(await svc.projects.create(actor, await body())));
