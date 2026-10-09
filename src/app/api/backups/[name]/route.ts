import { noContent, route } from "@/utils/api";
export const DELETE = route<{ name: string }>(async ({ svc, actor, params }) => (await svc.backups.remove(actor, params.name), noContent()));
