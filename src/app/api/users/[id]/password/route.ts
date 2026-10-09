import { route } from "@/utils/api";
export const POST = route<{ id: string }>(async ({ svc, actor, params, body }) => {
  await svc.users.resetPassword(actor, params.id, await body());
  return { ok: true };
});
