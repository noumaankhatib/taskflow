import { route } from "@/utils/api";
export const POST = route<{ name: string }>(({ svc, actor, params }) => svc.backups.restore(actor, params.name));
