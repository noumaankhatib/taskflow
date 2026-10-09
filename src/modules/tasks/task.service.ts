import type { Deps } from "@/services/shared";
import { alive, firstName, getProjectOrThrow } from "@/services/shared";
import type { Subtask, Task, TaskAssignee, User } from "@/schemas/entities";
import {
  CommentInput, SubtaskCreateInput, SubtaskUpdateInput, TaskCreateInput, TaskUpdateInput,
} from "@/schemas/inputs";
import { parse } from "@/utils/validate";
import { can, requirePerm, type Actor } from "@/utils/rbac";
import { forbidden, invalid, notFound } from "@/utils/errors";
import { csv, matchesText, today } from "@/utils/query";
import { round2 } from "@/utils/format";

export interface TaskView extends Task {
  primaryOwnerId: string | null;
  contributorIds: string[];
  actualHours: number;
  remainingHours: number;
  subtaskTotal: number;
  subtaskDone: number;
  commentCount: number;
  attachmentCount: number;
  isOverdue: boolean;
}

export interface TaskFilter {
  projectId?: string;
  assigneeId?: string;
  status?: string[];
  priority?: string[];
  tags?: string[];
  q?: string;
  dueFrom?: string;
  dueTo?: string;
  overdue?: boolean;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
  createdBy?: string;
}

export const taskFilterFromParams = (sp: URLSearchParams): TaskFilter => ({
  projectId: sp.get("projectId") ?? undefined,
  assigneeId: sp.get("assigneeId") ?? undefined,
  status: csv(sp.get("status")),
  priority: csv(sp.get("priority")),
  tags: csv(sp.get("tags")),
  q: sp.get("q") ?? undefined,
  dueFrom: sp.get("dueFrom") ?? undefined,
  dueTo: sp.get("dueTo") ?? undefined,
  overdue: sp.get("overdue") === "true" ? true : undefined,
  onlyDeleted: sp.get("deleted") === "true" ? true : undefined,
});

const isOpen = (t: Pick<Task, "status">) => t.status !== "COMPLETED" && t.status !== "CANCELLED";

export class TaskService {
  constructor(private d: Deps) {}

  /* ------------------------------ reads ------------------------------ */
  async list(f: TaskFilter = {}): Promise<TaskView[]> {
    const r = this.d.repos;
    let tasks = await r.tasks.findAll();
    const projects = new Map((await r.projects.findAll()).map((p) => [p.id, p]));
    tasks = tasks.filter((t) => {
      if (f.onlyDeleted ? !t.isDeleted : !f.includeDeleted && t.isDeleted) return false;
      // tasks of archived projects are hidden together with the project
      if (!f.onlyDeleted && !f.includeDeleted && projects.get(t.projectId)?.isDeleted) return false;
      return (
        (!f.projectId || t.projectId === f.projectId) &&
        (!f.status?.length || f.status.includes(t.status)) &&
        (!f.priority?.length || f.priority.includes(t.priority)) &&
        (!f.tags?.length || f.tags.some((x) => t.tags.map((y) => y.toLowerCase()).includes(x.toLowerCase()))) &&
        (!f.dueFrom || (t.dueDate !== null && t.dueDate >= f.dueFrom)) &&
        (!f.dueTo || (t.dueDate !== null && t.dueDate <= f.dueTo)) &&
        (!f.overdue || (isOpen(t) && !!t.dueDate && t.dueDate < today())) &&
        (!f.createdBy || t.createdBy === f.createdBy) &&
        matchesText(f.q, t.title, t.description, t.id, ...t.tags)
      );
    });
    const views = await this.buildViews(tasks);
    return (f.assigneeId
      ? views.filter((v) => v.primaryOwnerId === f.assigneeId || v.contributorIds.includes(f.assigneeId!))
      : views
    ).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string, includeDeleted = false) {
    const t = await this.d.repos.tasks.findById(id);
    if (!t || (t.isDeleted && !includeDeleted)) throw notFound("Task");
    const [view] = await this.buildViews([t]);
    const subtasks = (await this.d.repos.subtasks.find({ taskId: id })).sort((a, b) => a.id.localeCompare(b.id));
    return { ...view, subtasks };
  }

  private async buildViews(tasks: Task[]): Promise<TaskView[]> {
    if (!tasks.length) return [];
    const r = this.d.repos;
    const [assignees, time, subtasks, comments, attachments] = await Promise.all([
      r.taskAssignees.findAll(), r.timeEntries.findAll(), r.subtasks.findAll(), r.comments.findAll(), r.attachments.findAll(),
    ]);
    const by = <T extends { taskId: string }>(rows: T[]) => {
      const m = new Map<string, T[]>();
      for (const x of rows) (m.get(x.taskId) ?? m.set(x.taskId, []).get(x.taskId)!).push(x);
      return m;
    };
    const A = by(assignees), T = by(time), S = by(subtasks), C = by(comments);
    const att = new Map<string, number>();
    for (const a of attachments) if (!a.isDeleted && a.entityType === "TASK") att.set(a.entityId, (att.get(a.entityId) ?? 0) + 1);
    return tasks.map((t) => {
      const as = A.get(t.id) ?? [];
      const actual = (T.get(t.id) ?? []).reduce((s, e) => s + e.hours, 0);
      const subs = S.get(t.id) ?? [];
      return {
        ...t,
        primaryOwnerId: as.find((a) => a.role === "PRIMARY")?.userId ?? null,
        contributorIds: as.filter((a) => a.role === "CONTRIBUTOR").map((a) => a.userId),
        actualHours: round2(actual),
        remainingHours: round2(Math.max(t.estimatedHours - actual, 0)),
        subtaskTotal: subs.length,
        subtaskDone: subs.filter((s) => s.completed).length,
        commentCount: (C.get(t.id) ?? []).length,
        attachmentCount: att.get(t.id) ?? 0,
        isOverdue: isOpen(t) && !!t.dueDate && t.dueDate < today(),
      };
    });
  }

  /* ------------------------------ permissions ------------------------------ */
  private async canEdit(actor: Actor, t: Task): Promise<boolean> {
    if (can(actor.role, "task:manage")) return true;
    if (!can(actor.role, "task:write")) return false;
    if (t.createdBy === actor.id) return true;
    return (await this.d.repos.taskAssignees.find({ taskId: t.id })).some((a) => a.userId === actor.id);
  }

  private async mustEdit(actor: Actor, id: string) {
    const t = await this.d.repos.tasks.findById(id);
    if (!t || t.isDeleted) throw notFound("Task");
    if (!(await this.canEdit(actor, t))) throw forbidden("Only the task's owners or a project manager can change this task.");
    return t;
  }

  /* ------------------------------ writes ------------------------------ */
  async create(actor: Actor, raw: unknown) {
    requirePerm(actor, "task:write");
    const input = parse(TaskCreateInput, raw);
    const project = await getProjectOrThrow(this.d.repos, input.projectId);
    if (project.status === "COMPLETED" || project.status === "CANCELLED") {
      throw invalid(`Cannot add tasks to a ${project.status.toLowerCase()} project.`);
    }
    if (input.parentTaskId) {
      const parent = await this.d.repos.tasks.findById(input.parentTaskId);
      if (!parent || parent.isDeleted || parent.projectId !== input.projectId) throw invalid("Parent task must be in the same project.");
    }
    const { primaryOwnerId, contributorIds, ...fields } = input;
    const owner = primaryOwnerId ?? null;
    await this.validateAssignees(input.projectId, owner, contributorIds);
    const task = await this.d.repos.tasks.create({
      ...fields,
      startDate: fields.startDate ?? null,
      dueDate: fields.dueDate ?? null,
      parentTaskId: fields.parentTaskId ?? null,
      createdBy: actor.id,
      completedAt: fields.status === "COMPLETED" ? new Date().toISOString() : null,
      isDeleted: false, deletedAt: null, deletedBy: null,
    });
    await this.d.repos.taskAssignees.replaceForTask(task.id, owner, contributorIds);
    await this.d.activity.log({
      entityType: "TASK", entityId: task.id, projectId: task.projectId, action: "CREATED", userId: actor.id,
      newValue: { title: task.title }, message: `${actor.name} created task ${task.title}`,
    });
    await this.d.notifications.notify({
      userIds: [owner, ...contributorIds], excludeUserId: actor.id, type: "TASK_ASSIGNED",
      title: "New task assigned", message: `${firstName(actor.name)} assigned you "${task.title}".`,
      entityType: "TASK", entityId: task.id,
    });
    return this.get(task.id);
  }

  async update(actor: Actor, id: string, raw: unknown) {
    const before = await this.mustEdit(actor, id);
    const input = parse(TaskUpdateInput, raw);
    const { primaryOwnerId, contributorIds, ...fields } = input;
    const touchesAssignment = primaryOwnerId !== undefined || contributorIds !== undefined;
    // re-assigning people is a manager action
    if (touchesAssignment && !can(actor.role, "task:manage")) {
      const current = await this.d.repos.taskAssignees.find({ taskId: id });
      const cur = current.find((a) => a.role === "PRIMARY")?.userId ?? null;
      const curC = current.filter((a) => a.role === "CONTRIBUTOR").map((a) => a.userId).sort().join();
      const same = (primaryOwnerId === undefined || primaryOwnerId === cur) && (contributorIds === undefined || [...contributorIds].sort().join() === curC);
      if (!same) throw forbidden("Only a project manager can change task assignments.");
    }
    if (fields.parentTaskId) {
      if (fields.parentTaskId === id) throw invalid("A task cannot be its own parent.");
      const parent = await this.d.repos.tasks.findById(fields.parentTaskId);
      if (!parent || parent.isDeleted || parent.projectId !== before.projectId) throw invalid("Parent task must be in the same project.");
    }
    const patch: Partial<Task> = {};
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) (patch as Record<string, unknown>)[k] = v;
    if (patch.status && patch.status !== before.status) {
      patch.completedAt = patch.status === "COMPLETED" ? new Date().toISOString() : null;
    }
    const prev = await this.d.repos.taskAssignees.find({ taskId: id });
    const prevPrimary = prev.find((a) => a.role === "PRIMARY")?.userId ?? null;
    const prevContrib = prev.filter((a) => a.role === "CONTRIBUTOR").map((a) => a.userId);
    let nowPrimary = prevPrimary, nowContrib = prevContrib;
    if (touchesAssignment) {
      nowPrimary = primaryOwnerId !== undefined ? primaryOwnerId : prevPrimary;
      nowContrib = contributorIds ?? prevContrib;
      await this.validateAssignees(before.projectId, nowPrimary, nowContrib); // validate before anything is written
    }
    const after = await this.d.repos.tasks.update(id, patch);
    if (touchesAssignment) await this.d.repos.taskAssignees.replaceForTask(id, nowPrimary, nowContrib);
    const prevAll = new Set([prevPrimary, ...prevContrib].filter(Boolean) as string[]);
    const nowAll = new Set([nowPrimary, ...nowContrib].filter(Boolean) as string[]);
    const added = [...nowAll].filter((u) => !prevAll.has(u));
    const removed = [...prevAll].filter((u) => !nowAll.has(u));

    if (before.status !== after.status) {
      await this.d.activity.log({
        entityType: "TASK", entityId: id, projectId: after.projectId, action: "STATUS_CHANGED", userId: actor.id,
        oldValue: before.status, newValue: after.status,
        message: `${actor.name} changed status from ${pretty(before.status)} → ${pretty(after.status)} on "${after.title}"`,
      });
    }
    if (added.length || removed.length || prevPrimary !== nowPrimary) {
      const names = await this.names([...added]);
      await this.d.activity.log({
        entityType: "TASK", entityId: id, projectId: after.projectId, action: "ASSIGNMENT_CHANGED", userId: actor.id,
        oldValue: { primaryOwnerId: prevPrimary, contributorIds: prevContrib },
        newValue: { primaryOwnerId: nowPrimary, contributorIds: nowContrib },
        message: added.length
          ? `${actor.name} assigned "${after.title}" to ${names.join(", ")}`
          : `${actor.name} changed assignees on "${after.title}"`,
      });
    }
    const otherFields = Object.keys(patch).filter((k) => !["status", "completedAt"].includes(k));
    if (otherFields.length) {
      await this.d.activity.log({
        entityType: "TASK", entityId: id, projectId: after.projectId, action: "UPDATED", userId: actor.id,
        oldValue: Object.fromEntries(otherFields.map((k) => [k, (before as Record<string, unknown>)[k]])),
        newValue: Object.fromEntries(otherFields.map((k) => [k, (after as Record<string, unknown>)[k]])),
        message: `${actor.name} updated ${otherFields.join(", ")} on "${after.title}"`,
      });
    }

    // notifications
    const team = [...nowAll];
    await this.d.notifications.notify({
      userIds: added, excludeUserId: actor.id, type: "TASK_ASSIGNED", title: "Task assigned to you",
      message: `${firstName(actor.name)} assigned you "${after.title}".`, entityType: "TASK", entityId: id,
    });
    if (before.status !== after.status) {
      const proj = await this.d.repos.projects.findById(after.projectId);
      if (after.status === "COMPLETED") {
        await this.d.notifications.notify({
          userIds: [...team, after.createdBy, proj?.projectManagerId], excludeUserId: actor.id, type: "TASK_COMPLETED",
          severity: "SUCCESS", title: "Task completed", message: `"${after.title}" was marked complete by ${firstName(actor.name)}.`,
          entityType: "TASK", entityId: id,
        });
      } else {
        await this.d.notifications.notify({
          userIds: team.filter((u) => !added.includes(u)), excludeUserId: actor.id, type: "TASK_UPDATED",
          title: "Task status changed", message: `"${after.title}" moved ${pretty(before.status)} → ${pretty(after.status)}.`,
          entityType: "TASK", entityId: id, severity: after.status === "BLOCKED" ? "WARNING" : "INFO",
        });
      }
    }
    return this.get(id);
  }

  async softDelete(actor: Actor, id: string) {
    const t = await this.d.repos.tasks.findById(id);
    if (!t || t.isDeleted) throw notFound("Task");
    if (!can(actor.role, "task:manage") && !(t.createdBy === actor.id && can(actor.role, "task:write"))) throw forbidden();
    await this.d.repos.tasks.update(id, { isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: actor.id });
    await this.d.activity.log({
      entityType: "TASK", entityId: id, projectId: t.projectId, action: "DELETED", userId: actor.id,
      message: `${actor.name} deleted task "${t.title}"`,
    });
  }

  async restore(actor: Actor, id: string) {
    requirePerm(actor, "task:manage");
    const t = await this.d.repos.tasks.findById(id);
    if (!t || !t.isDeleted) throw notFound("Task");
    await this.d.repos.tasks.update(id, { isDeleted: false, deletedAt: null, deletedBy: null });
    await this.d.activity.log({
      entityType: "TASK", entityId: id, projectId: t.projectId, action: "RESTORED", userId: actor.id,
      message: `${actor.name} restored task "${t.title}"`,
    });
    return this.get(id);
  }

  /* ------------------------------ subtasks ------------------------------ */
  async addSubtask(actor: Actor, taskId: string, raw: unknown): Promise<Subtask> {
    const t = await this.mustEdit(actor, taskId);
    const { title } = parse(SubtaskCreateInput, raw);
    const s = await this.d.repos.subtasks.create({ taskId, title, completed: false, completedAt: null });
    await this.d.activity.log({
      entityType: "SUBTASK", entityId: s.id, projectId: t.projectId, action: "CREATED", userId: actor.id,
      message: `${actor.name} added subtask "${title}" to "${t.title}"`,
    });
    return s;
  }

  async updateSubtask(actor: Actor, taskId: string, subId: string, raw: unknown): Promise<Subtask> {
    const t = await this.mustEdit(actor, taskId);
    const s = await this.d.repos.subtasks.findById(subId);
    if (!s || s.taskId !== taskId) throw notFound("Subtask");
    const patch = parse(SubtaskUpdateInput, raw);
    const next = await this.d.repos.subtasks.update(subId, {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.completed !== undefined
        ? { completed: patch.completed, completedAt: patch.completed ? new Date().toISOString() : null }
        : {}),
    });
    if (patch.completed !== undefined && patch.completed !== s.completed) {
      await this.d.activity.log({
        entityType: "SUBTASK", entityId: subId, projectId: t.projectId, action: "STATUS_CHANGED", userId: actor.id,
        oldValue: s.completed, newValue: next.completed,
        message: `${actor.name} ${next.completed ? "completed" : "reopened"} subtask "${s.title}"`,
      });
    }
    return next;
  }

  async deleteSubtask(actor: Actor, taskId: string, subId: string) {
    const t = await this.mustEdit(actor, taskId);
    const s = await this.d.repos.subtasks.findById(subId);
    if (!s || s.taskId !== taskId) throw notFound("Subtask");
    await this.d.repos.subtasks.delete(subId);
    await this.d.activity.log({
      entityType: "SUBTASK", entityId: subId, projectId: t.projectId, action: "DELETED", userId: actor.id,
      message: `${actor.name} removed subtask "${s.title}" from "${t.title}"`,
    });
  }

  /* ------------------------------ comments ------------------------------ */
  async comments(taskId: string) {
    const t = await this.d.repos.tasks.findById(taskId);
    if (!t || t.isDeleted) throw notFound("Task");
    return (await this.d.repos.comments.find({ taskId })).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  async addComment(actor: Actor, taskId: string, raw: unknown) {
    requirePerm(actor, "comment:write");
    const t = await this.d.repos.tasks.findById(taskId);
    if (!t || t.isDeleted) throw notFound("Task");
    const { message } = parse(CommentInput, raw);
    const c = await this.d.repos.comments.create({ taskId, userId: actor.id, message });
    await this.d.activity.log({
      entityType: "COMMENT", entityId: c.id, projectId: t.projectId, action: "COMMENT_ADDED", userId: actor.id,
      newValue: { taskId }, message: `${actor.name} added a comment on "${t.title}"`,
    });
    const users = alive(await this.d.repos.users.findAll()).filter((u) => u.active);
    const mentioned = mentionedUsers(message, users).filter((u) => u.id !== actor.id);
    await this.d.notifications.notify({
      userIds: mentioned.map((u) => u.id), type: "MENTION", title: `${firstName(actor.name)} mentioned you`,
      message: `On "${t.title}": ${message.slice(0, 120)}`, entityType: "TASK", entityId: taskId,
    });
    const assignees = (await this.d.repos.taskAssignees.find({ taskId })).map((a) => a.userId);
    await this.d.notifications.notify({
      userIds: [...assignees, t.createdBy].filter((u) => !mentioned.some((m) => m.id === u)), excludeUserId: actor.id,
      type: "COMMENT", title: "New comment", message: `${firstName(actor.name)} commented on "${t.title}".`,
      entityType: "TASK", entityId: taskId,
    });
    return c;
  }

  async updateComment(actor: Actor, taskId: string, commentId: string, raw: unknown) {
    const c = await this.d.repos.comments.findById(commentId);
    if (!c || c.taskId !== taskId) throw notFound("Comment");
    if (c.userId !== actor.id) throw forbidden("You can only edit your own comments.");
    const { message } = parse(CommentInput, raw);
    return this.d.repos.comments.update(commentId, { message });
  }

  async deleteComment(actor: Actor, taskId: string, commentId: string) {
    const c = await this.d.repos.comments.findById(commentId);
    if (!c || c.taskId !== taskId) throw notFound("Comment");
    if (c.userId !== actor.id && !can(actor.role, "task:manage")) throw forbidden("You can only delete your own comments.");
    await this.d.repos.comments.delete(commentId);
  }

  /* ------------------------------ helpers ------------------------------ */
  private async names(ids: string[]) {
    const users = await this.d.repos.users.findAll();
    return ids.map((id) => users.find((u) => u.id === id)?.name ?? id);
  }

  /** Assignees must be real, active users and members of the task's project. */
  private async validateAssignees(projectId: string, primary: string | null, contributors: string[]) {
    const ids = [...new Set([primary, ...contributors].filter(Boolean) as string[])];
    if (!ids.length) return;
    const [users, project, members] = await Promise.all([
      this.d.repos.users.findAll(), this.d.repos.projects.findById(projectId), this.d.repos.projectMembers.find({ projectId }),
    ]);
    for (const id of ids) {
      const u = users.find((x) => x.id === id);
      if (!u || u.isDeleted) throw invalid(`User ${id} does not exist.`);
      if (!u.active) throw invalid(`${u.name} is inactive and cannot be assigned.`);
      if (project?.projectManagerId !== id && !members.some((m) => m.userId === id)) {
        throw invalid(`${u.name} is not a member of this project. Add them to the project team first.`);
      }
    }
  }
}

export const pretty = (s: string) => s.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

/** @Nouman or @NoumanKhatib (case-insensitive, first name or full name without spaces). */
export function mentionedUsers(message: string, users: User[]): User[] {
  const handles = [...message.matchAll(/@([\p{L}\p{N}_.-]+)/gu)].map((m) => m[1].toLowerCase());
  if (!handles.length) return [];
  return users.filter((u) => {
    const first = u.name.split(" ")[0].toLowerCase();
    const full = u.name.replace(/\s+/g, "").toLowerCase();
    return handles.includes(first) || handles.includes(full);
  });
}

export type { TaskAssignee };
