import type { Project } from "@/schemas/entities";
import type { Health } from "@/modules/projects/project.service";
import type { ProjectFinancials } from "@/modules/projects/finance";

export interface ProjectView extends Project {
  memberIds: string[];
  taskStats: { total: number; done: number; overdue: number; openIssues: number; urgentIssues: number };
  progress: number;
  health: Health;
  financials: ProjectFinancials | null;
}
