import { route } from "@/utils/api";
export const GET = route(({ svc, actor, sp }) => svc.search.search(actor, sp.get("q") ?? ""));
