import { route } from "@/utils/api";
export const POST = route(async ({ svc, actor, body }) => svc.backups.import(actor, await body()));
