import { PageHeader } from "@/components/ui/display";
import { ExpensesWorkspace } from "@/modules/expenses/components/ExpensesWorkspace";

export const metadata = { title: "Expenses" };

export default function ExpensesPage() {
  return (
    <>
      <PageHeader title="Expenses" description="Project costs, receipts and approvals." />
      <ExpensesWorkspace />
    </>
  );
}
