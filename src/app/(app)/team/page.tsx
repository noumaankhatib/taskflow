import { Suspense } from "react";
import { TeamPage } from "@/modules/users/components/TeamPage";

export const metadata = { title: "Team" };

export default function Page() {
  return <Suspense><TeamPage /></Suspense>;
}
