import { CardsSkeleton } from "@/components/ui/feedback";
export default function Loading() {
  return <div className="space-y-6"><div className="h-8 w-48 animate-pulse rounded-md bg-slate-200/70" /><CardsSkeleton /></div>;
}
