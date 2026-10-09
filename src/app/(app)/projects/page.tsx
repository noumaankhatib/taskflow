import { Suspense } from "react";
import { ProjectsList } from "@/modules/projects/components/ProjectsList";
import { CardsSkeleton } from "@/components/ui/feedback";

export const metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <Suspense fallback={<CardsSkeleton count={3} />}>
      <ProjectsList />
    </Suspense>
  );
}
