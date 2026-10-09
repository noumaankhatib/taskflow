import { Suspense } from "react";
import { ClientsPage } from "@/modules/clients/components/ClientsPage";

export const metadata = { title: "Clients" };

export default function Page() {
  return <Suspense><ClientsPage /></Suspense>;
}
