import { noContent, route } from "@/utils/api";
export const DELETE = route<{ id: string }>(async ({ svc, actor, params }) => (await svc.notifications.remove(params.id, actor.id), noContent()));
