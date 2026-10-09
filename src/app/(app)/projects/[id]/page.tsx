import { Suspense } from "react";
import { ProjectDetail } from "@/modules/projects/components/ProjectDetail";
import { CardsSkeleton } from "@/components/ui/feedback";

export const metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<CardsSkeleton count={3} />}>
      <ProjectDetail id={id} />
    </Suspense>
  );
}
