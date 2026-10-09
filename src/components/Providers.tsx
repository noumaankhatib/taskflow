"use client";
import type { ReactNode } from "react";
import type { PublicUser } from "@/schemas/entities";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/overlay";
import { LookupProvider, MeProvider } from "@/lib/lookups";

export function Providers({ user, children }: { user: PublicUser; children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <MeProvider user={user}>
          <LookupProvider>{children}</LookupProvider>
        </MeProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
