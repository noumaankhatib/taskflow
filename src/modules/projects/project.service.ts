import type { Deps } from "@/services/shared";
import { alive, firstName, getProjectOrThrow } from "@/services/shared";
import type { Project } from "@/schemas/entities";
import { ProjectCreateInput, ProjectUpdateInput } from "@/schemas/inputs";
import { parse } from "@/utils/validate";
import { can, requirePerm, type Actor } from "@/utils/rbac";
import { invalid, notFound } from "@/utils/errors";
import { matchesText, today } from "@/utils/query";
import { computeFinancials, type ProjectFinancials } from "./finance";
import type { BackupService } from "@/services/BackupService";

export interface ProjectFilter {
  q?: string;
  status?: string[];
  priority?: string[];
  clientId?: string;
  memberId?: string;
  managerId?: string;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
}

export type Health = "ON_TRACK" | "AT_RISK" | "DELAYED" | "DONE";

export class ProjectService {
  constructor(
    private d: Deps,
    private backups: () => BackupService,
  ) {}

  /** Collect everything once so list views don't do N+1 lookups. */
  private async snapshot() {
    const r = this.d.repos;
    const [projects, members, tasks, expenses, payments, time, users] = await Promise.all([
      r.projects.findAll(), r.projectMembers.findAll(), r.tasks.findAll(), r.expenses.findAll(),
      r.payments.findAll(), r.timeEntries.findAll(), r.users.findAll(),
    ]);
    return { projects, members, tasks, expenses, payments, time, users };
  }

  async list(actor: Actor, f: ProjectFilter = {}) {
    const s = await this.snapshot();
    const showFin = can(actor.role, "finance:view");
    const rows = s.projects.filter((p) => {
      if (f.onlyDeleted ? !p.isDeleted : !f.includeDeleted && p.isDeleted) return false;
      const memberIds = s.members.filter((m) => m.projectId === p.id).map((m) => m.userId);
      return (
        matchesText(f.q, p.name, p.description, p.id) &&
        (!f.status?.length || f.status.includes(p.status)) &&
        (!f.priority?.length || f.priority.includes(p.priority)) &&
        (!f.clientId || p.clientId === f.clientId) &&
        (!f.managerId || p.projectManagerId === f.managerId) &&
        (!f.memberId || memberIds.includes(f.memberId) || p.projectManagerId === f.memberId)
      );
    });
    return rows
      .map((p) => this.view(p, s, showFin))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(actor: Actor, id: string, includeDeleted = false) {
    const s = await this.snapshot();
    const p = s.projects.find((x) => x.id === id);
    if (!p || (p.isDeleted && !includeDeleted)) throw notFound("Project");
    return this.view(p, s, can(actor.role, "finance:view"));
  }

  async financials(projectId: string): Promise<ProjectFinancials> {
    const s = await this.snapshot();
    const p = s.projects.find((x) => x.id === projectId);
    if (!p) throw notFound("Project");
    return this.fin(p, s);
  }

  private fin(p: Project, s: Awaited<ReturnType<ProjectService["snapshot"]>>) {
    return computeFinancials({
      project: p,
      payments: s.payments.filter((x) => x.projectId === p.id),
      expenses: s.expenses.filter((x) => x.projectId === p.id),
      timeEntries: s.time.filter((x) => x.projectId === p.id),
      users: s.users,
      tasks: s.tasks.filter((x) => x.projectId === p.id),
    });
  }

  private view(p: Project, s: Awaited<ReturnType<ProjectService["snapshot"]>>, showFin: boolean) {
    const tasks = s.tasks.filter((t) => t.projectId === p.id && !t.isDeleted && t.status !== "CANCELLED");
    const done = tasks.filter((t) => t.status === "COMPLETED").length;
    const open = tasks.filter((t) => t.status !== "COMPLETED");
    const overdue = open.filter((t) => t.dueDate && t.dueDate < today()).length;
    const memberIds = [...new Set(s.members.filter((m) => m.projectId === p.id).map((m) => m.userId))];
    return {
      ...p,
      memberIds,
      taskStats: { total: tasks.length, done, overdue },
      progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      health: projectHealth(p, overdue, open.length),
      financials: showFin ? this.fin(p, s) : null,
    };
  }

  async create(actor: Actor, raw: unknown) {
    requirePerm(actor, "project:write");
    const input = parse(ProjectCreateInput, raw);
    await this.validateRefs(input.clientId, input.projectManagerId, input.memberIds);
    const { memberIds, ...fields } = input;
    const project = await this.d.repos.projects.create({
      ...fields,
      startDate: fields.startDate ?? null,
      expectedEndDate: fields.expectedEndDate ?? null,
      actualEndDate: fields.actualEndDate ?? null,
      projectManagerId: fields.projectManagerId ?? null,
      createdBy: actor.id,
      isDeleted: false, deletedAt: null, deletedBy: null,
    });
    const members = new Set(memberIds);
    if (project.projectManagerId) members.add(project.projectManagerId);
    await this.d.repos.projectMembers.createMany([...members].map((userId) => ({ projectId: project.id, userId })));
    await this.d.activity.log({
      entityType: "PROJECT", entityId: project.id, projectId: project.id, action: "CREATED", userId: actor.id,
      newValue: { name: project.name }, message: `${actor.name} created project ${project.name}`,
    });
    await this.d.notifications.notify({
      userIds: members, excludeUserId: actor.id, type: "PROJECT_UPDATE", severity: "INFO",
      title: `Added to project ${project.name}`, message: `${firstName(actor.name)} added you to ${project.name}.`,
      entityType: "PROJECT", entityId: project.id,
    });
    return this.get(actor, project.id);
  }

  async update(actor: Actor, id: string, raw: unknown) {
    requirePerm(actor, "project:write");
    const before = await getProjectOrThrow(this.d.repos, id);
    const input = parse(ProjectUpdateInput, raw);
    await this.validateRefs(input.clientId, input.projectManagerId, input.memberIds);
    const { memberIds, ...fields } = input;
    const patch: Partial<Project> = { ...(fields as Partial<Project>) };
    for (const k of ["startDate", "expectedEndDate", "actualEndDate", "projectManagerId"] as const) {
      if (k in patch && patch[k] === undefined) delete patch[k];
    }
    const status = patch.status ?? before.status;
    if (status === "COMPLETED" && !(patch.actualEndDate ?? before.actualEndDate)) patch.actualEndDate = today();
    if (status !== "COMPLETED" && patch.status && before.status === "COMPLETED" && !("actualEndDate" in fields)) {
      patch.actualEndDate = null;
    }
    const after = await this.d.repos.projects.update(id, patch);

    let newMembers: string[] = [];
    if (memberIds || fields.projectManagerId) {
      const current = (await this.d.repos.projectMembers.find({ projectId: id })).map((m) => m.userId);
      const want = new Set(memberIds ?? current);
      if (after.projectManagerId) want.add(after.projectManagerId);
      const toAdd = [...want].filter((u) => !current.includes(u));
      const toRemove = memberIds ? current.filter((u) => !want.has(u)) : [];
      if (toAdd.length) await this.d.repos.projectMembers.createMany(toAdd.map((userId) => ({ projectId: id, userId })));
      for (const u of toRemove) await this.d.repos.projectMembers.deleteWhere({ projectId: id, userId: u });
      newMembers = toAdd;
      if (toAdd.length || toRemove.length) {
        await this.d.activity.log({
          entityType: "PROJECT", entityId: id, projectId: id, action: "ASSIGNMENT_CHANGED", userId: actor.id,
          oldValue: current, newValue: [...want], message: `${actor.name} updated the team of ${after.name}`,
        });
      }
    }
    if (before.status !== after.status) {
      await this.d.activity.log({
        entityType: "PROJECT", entityId: id, projectId: id, action: "STATUS_CHANGED", userId: actor.id,
        oldValue: before.status, newValue: after.status,
        message: `${actor.name} changed project status from ${before.status} → ${after.status}`,
      });
    } else {
      await this.d.activity.log({
        entityType: "PROJECT", entityId: id, projectId: id, action: "UPDATED", userId: actor.id,
        message: `${actor.name} updated project ${after.name}`,
      });
    }
    const team = (await this.d.repos.projectMembers.find({ projectId: id })).map((m) => m.userId);
    await this.d.notifications.notify({
      userIds: before.status !== after.status ? team : newMembers, excludeUserId: actor.id, type: "PROJECT_UPDATE",
      title: before.status !== after.status ? `${after.name} is now ${after.status.replace("_", " ").toLowerCase()}` : `Added to project ${after.name}`,
      message: `Updated by ${firstName(actor.name)}.`, entityType: "PROJECT", entityId: id,
      severity: after.status === "COMPLETED" ? "SUCCESS" : "INFO",
    });
    return this.get(actor, id);
  }

  async softDelete(actor: Actor, id: string) {
    requirePerm(actor, "project:delete");
    const p = await getProjectOrThrow(this.d.repos, id);
    await this.backups().create("pre-delete-project", actor.id); // safety net for a destructive op
    await this.d.repos.projects.update(id, { isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: actor.id });
    await this.d.activity.log({
      entityType: "PROJECT", entityId: id, projectId: id, action: "DELETED", userId: actor.id,
      message: `${actor.name} archived project ${p.name}`,
    });
  }

  async restore(actor: Actor, id: string) {
    requirePerm(actor, "project:delete");
    const p = await this.d.repos.projects.findById(id);
    if (!p || !p.isDeleted) throw notFound("Project");
    await this.d.repos.projects.update(id, { isDeleted: false, deletedAt: null, deletedBy: null });
    await this.d.activity.log({
      entityType: "PROJECT", entityId: id, projectId: id, action: "RESTORED", userId: actor.id,
      message: `${actor.name} restored project ${p.name}`,
    });
    return this.get(actor, id);
  }

  async members(projectId: string) {
    await getProjectOrThrow(this.d.repos, projectId);
    const [members, users] = await Promise.all([this.d.repos.projectMembers.find({ projectId }), this.d.repos.users.findAll()]);
    return members.map((m) => users.find((u) => u.id === m.userId)).filter((u) => u && !u.isDeleted).map((u) => u!.id);
  }

  async isMember(projectId: string, userId: string) {
    const [p, members] = await Promise.all([this.d.repos.projects.findById(projectId), this.d.repos.projectMembers.find({ projectId })]);
    return !!p && (p.projectManagerId === userId || members.some((m) => m.userId === userId));
  }

  private async validateRefs(clientId?: string, managerId?: string | null, memberIds?: string[]) {
    if (clientId) {
      const c = await this.d.repos.clients.findById(clientId);
      if (!c) throw invalid("Selected client does not exist.");
      if (!c.active) throw invalid("Selected client is inactive.");
    }
    const ids = [managerId, ...(memberIds ?? [])].filter(Boolean) as string[];
    if (ids.length) {
      const users = alive(await this.d.repos.users.findAll());
      for (const id of ids) {
        const u = users.find((x) => x.id === id);
        if (!u || !u.active) throw invalid(`User ${id} does not exist or is inactive.`);
      }
    }
  }
}

/** Derived, never stored. */
export function projectHealth(p: Pick<Project, "status" | "expectedEndDate">, overdueTasks: number, openTasks: number): Health {
  if (p.status === "COMPLETED") return "DONE";
  if (p.status !== "ACTIVE") return "ON_TRACK";
  if (p.expectedEndDate && p.expectedEndDate < today() && openTasks > 0) return "DELAYED";
  if (overdueTasks >= 2 || (openTasks > 0 && overdueTasks / openTasks >= 0.25)) return "AT_RISK";
  return "ON_TRACK";
}
