import { Suspense } from "react";
import { SettingsPage } from "@/modules/settings/components/SettingsPage";

export const metadata = { title: "Settings" };

export default function Page() {
  return <Suspense><SettingsPage /></Suspense>;
}
