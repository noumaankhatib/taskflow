import { created, paged, route } from "@/utils/api";
import { paginate, parsePageQuery } from "@/utils/query";

export const GET = route(async ({ svc, sp }) => {
  const rows = await svc.clients.list({ q: sp.get("q") ?? undefined, active: sp.has("active") ? sp.get("active") === "true" : undefined });
  return paged(paginate(rows, parsePageQuery(sp, { pageSize: 100 }), ["companyName", "projectCount", "createdAt"]));
});
export const POST = route(async ({ svc, actor, body }) => created(await svc.clients.create(actor, await body())));
