import { created, route } from "@/utils/api";
import { requirePerm } from "@/utils/rbac";
export const GET = route(async ({ svc, actor }) => (requirePerm(actor, "backup:manage"), svc.backups.list()));
export const POST = route(async ({ svc, actor }) => created(await svc.backups.backupNow(actor)));
