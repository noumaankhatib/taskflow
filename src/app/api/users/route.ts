import { created, paged, route } from "@/utils/api";
import { paginate, parsePageQuery } from "@/utils/query";

export const GET = route(async ({ svc, actor, sp }) => {
  const rows = await svc.users.list(actor, {
    q: sp.get("q") ?? undefined, role: sp.get("role") ?? undefined,
    active: sp.has("active") ? sp.get("active") === "true" : undefined, includeDeleted: sp.get("deleted") === "true",
  });
  return paged(paginate(rows, parsePageQuery(sp, { pageSize: 100 }), ["name", "email", "role", "createdAt"]));
});
export const POST = route(async ({ svc, actor, body }) => created(await svc.users.create(actor, await body())));
