import { route } from "@/utils/api";
export const PUT = route<{ id: string }>(async ({ svc, actor, params, req }) => {
  const body = await req.json().catch(() => ({}));
  return svc.notifications.markRead(params.id, actor.id, body?.isRead !== false);
});
