"use client";
import { ErrorState } from "@/components/ui/feedback";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  // the real error was already logged by Next on the server; never show stack traces here
  return <ErrorState error={new Error("This page ran into a problem. Please try again.")} onRetry={reset} className="py-24" />;
}
