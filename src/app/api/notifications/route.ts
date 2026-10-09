import { paged, route } from "@/utils/api";
import { paginate, parsePageQuery } from "@/utils/query";

export const GET = route(async ({ svc, actor, sp }) => {
  await svc.alerts.sync();
  const rows = await svc.notifications.list(actor.id, { unreadOnly: sp.get("unread") === "true" });
  return paged(paginate(rows, parsePageQuery(sp, { pageSize: 30 })), { unread: await svc.notifications.unreadCount(actor.id) });
});
