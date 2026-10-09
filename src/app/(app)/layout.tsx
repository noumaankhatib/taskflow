import { requireUser } from "@/utils/auth";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <Providers user={user}>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
