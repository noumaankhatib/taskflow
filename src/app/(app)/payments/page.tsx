import { PageHeader } from "@/components/ui/display";
import { PaymentsWorkspace } from "@/modules/payments/components/PaymentsWorkspace";

export const metadata = { title: "Payments" };

export default function PaymentsPage() {
  return (
    <>
      <PageHeader title="Payments" description="Client invoices, receipts and outstanding balances." />
      <PaymentsWorkspace />
    </>
  );
}
