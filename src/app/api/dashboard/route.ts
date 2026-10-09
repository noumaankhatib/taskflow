import { route } from "@/utils/api";
export const GET = route(async ({ svc, actor }) => {
  await svc.alerts.sync();
  return svc.dashboard.get(actor);
});
