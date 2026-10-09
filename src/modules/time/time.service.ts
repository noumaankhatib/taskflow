import type { Deps } from "@/services/shared";
import { getProjectOrThrow } from "@/services/shared";
import { TimeEntryInput, TimeEntryUpdateInput } from "@/schemas/inputs";
import { parse } from "@/utils/validate";
import { can, requirePerm, type Actor } from "@/utils/rbac";
import { forbidden, invalid, notFound } from "@/utils/errors";

export interface TimeFilter { taskId?: string; projectId?: string; userId?: string; from?: string; to?: string }

export class TimeEntryService {
  constructor(private d: Deps) {}

  async list(f: TimeFilter = {}) {
    return (await this.d.repos.timeEntries.findAll())
      .filter(
        (t) =>
          (!f.taskId || t.taskId === f.taskId) && (!f.projectId || t.projectId === f.projectId) &&
          (!f.userId || t.userId === f.userId) && (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  async create(actor: Actor, raw: unknown) {
    requirePerm(actor, "time:write");
    const input = parse(TimeEntryInput, raw);
    const task = await this.d.repos.tasks.findById(input.taskId);
    if (!task || task.isDeleted) throw notFound("Task");
    await getProjectOrThrow(this.d.repos, task.projectId);
    const userId = input.userId ?? actor.id;
    if (userId !== actor.id && !can(actor.role, "task:manage")) throw forbidden("You can only log time for yourself.");
    const user = await this.d.repos.users.findById(userId);
    if (!user || user.isDeleted || !user.active) throw invalid("Selected user does not exist or is inactive.");
    const { userId: _u, ...rest } = input;
    void _u;
    const entry = await this.d.repos.timeEntries.create({ ...rest, userId, projectId: task.projectId });
    await this.d.activity.log({
      entityType: "TIME_ENTRY", entityId: entry.id, projectId: task.projectId, action: "TIME_LOGGED", userId: actor.id,
      newValue: { hours: entry.hours, taskId: task.id },
      message: `${actor.name} logged ${entry.hours}h on "${task.title}"`,
    });
    return entry;
  }

  async update(actor: Actor, id: string, raw: unknown) {
    const e = await this.d.repos.timeEntries.findById(id);
    if (!e) throw notFound("Time entry");
    if (e.userId !== actor.id && !can(actor.role, "task:manage")) throw forbidden();
    requirePerm(actor, "time:write");
    const patch = parse(TimeEntryUpdateInput, raw);
    return this.d.repos.timeEntries.update(id, patch);
  }

  async remove(actor: Actor, id: string) {
    const e = await this.d.repos.timeEntries.findById(id);
    if (!e) throw notFound("Time entry");
    if (e.userId !== actor.id && !can(actor.role, "task:manage")) throw forbidden();
    requirePerm(actor, "time:write");
    await this.d.repos.timeEntries.delete(id);
  }
}
