import { route } from "@/utils/api";
export const GET = route(({ svc }) => svc.dashboard.teamWorkload());
