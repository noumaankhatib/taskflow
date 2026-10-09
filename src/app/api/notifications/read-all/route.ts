import { route } from "@/utils/api";
export const POST = route(async ({ svc, actor }) => ({ updated: await svc.notifications.markAllRead(actor.id) }));
