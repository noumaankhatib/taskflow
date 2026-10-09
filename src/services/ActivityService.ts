import type { Repositories } from "@/repositories/interfaces";
import type { Activity, ActivityAction, EntityType } from "@/schemas/entities";

export interface LogInput {
  entityType: EntityType;
  entityId: string;
  action: ActivityAction;
  userId: string;
  projectId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  message: string;
}

/** Append-only audit trail. Never throws into the caller's flow: auditing must not break a successful write. */
export class ActivityService {
  constructor(private repos: Repositories) {}

  async log(i: LogInput): Promise<Activity | null> {
    try {
      return await this.repos.activity.create({
        entityType: i.entityType,
        entityId: i.entityId,
        projectId: i.projectId ?? null,
        action: i.action,
        userId: i.userId,
        oldValue: i.oldValue ?? null,
        newValue: i.newValue ?? null,
        message: i.message,
      });
    } catch (err) {
      console.error("Failed to write activity entry", err);
      return null;
    }
  }

  async list(filter: { entityType?: string; entityId?: string; projectId?: string; limit?: number } = {}) {
    let rows = await this.repos.activity.findAll();
    if (filter.entityType) rows = rows.filter((r) => r.entityType === filter.entityType);
    if (filter.entityId) rows = rows.filter((r) => r.entityId === filter.entityId);
    if (filter.projectId) rows = rows.filter((r) => r.projectId === filter.projectId);
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    return rows.slice(0, filter.limit ?? 100);
  }
}
