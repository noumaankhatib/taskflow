import { route } from "@/utils/api";
export const POST = route<{ id: string }>(async ({ svc, actor, params, body }) => svc.expenses.decide(actor, params.id, await body()));
