import type { Repositories } from "@/repositories/interfaces";
import type { NotificationType, Severity } from "@/schemas/entities";
import { forbidden, notFound } from "@/utils/errors";

export interface NotifyInput {
  userIds: Iterable<string | null | undefined>;
  type: NotificationType;
  title: string;
  message?: string;
  severity?: Severity;
  entityType?: string | null;
  entityId?: string | null;
  /** the acting user never notifies themself */
  excludeUserId?: string;
}

/** Generic notifications: any module can raise one for any (entityType, entityId) pair. */
export class NotificationService {
  constructor(private repos: Repositories) {}

  async notify(i: NotifyInput) {
    const ids = new Set<string>();
    for (const u of i.userIds) if (u && u !== i.excludeUserId) ids.add(u);
    if (!ids.size) return [];
    // only deliver to real, active users
    const users = await this.repos.users.findAll();
    const valid = new Set(users.filter((u) => u.active && !u.isDeleted).map((u) => u.id));
    const rows = [...ids].filter((id) => valid.has(id)).map((userId) => ({
      userId,
      type: i.type,
      title: i.title,
      message: i.message ?? "",
      severity: i.severity ?? "INFO",
      entityType: i.entityType ?? null,
      entityId: i.entityId ?? null,
      isRead: false,
    }));
    try {
      return await this.repos.notifications.createMany(rows);
    } catch (err) {
      console.error("Failed to create notifications", err); // never break the main operation
      return [];
    }
  }

  async list(userId: string, opts: { unreadOnly?: boolean } = {}) {
    const rows = (await this.repos.notifications.find({ userId })).filter((n) => !opts.unreadOnly || !n.isRead);
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }

  async unreadCount(userId: string) {
    return (await this.repos.notifications.find({ userId, isRead: false })).length;
  }

  async markRead(id: string, userId: string, isRead = true) {
    const n = await this.repos.notifications.findById(id);
    if (!n) throw notFound("Notification");
    if (n.userId !== userId) throw forbidden();
    return this.repos.notifications.update(id, { isRead });
  }

  markAllRead(userId: string) {
    return this.repos.notifications.markAllRead(userId);
  }

  async remove(id: string, userId: string) {
    const n = await this.repos.notifications.findById(id);
    if (!n) throw notFound("Notification");
    if (n.userId !== userId) throw forbidden();
    await this.repos.notifications.delete(id);
  }
}
