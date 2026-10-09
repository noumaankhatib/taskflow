import type { Repositories } from "@/repositories/interfaces";
import type { Actor } from "@/utils/rbac";
import type { ActivityService } from "./ActivityService";
import type { NotificationService } from "./NotificationService";
import { forbidden, notFound } from "@/utils/errors";
import { can } from "@/utils/rbac";
import type { User } from "@/schemas/entities";

export interface Deps {
  repos: Repositories;
  activity: ActivityService;
  notifications: NotificationService;
}

export const alive = <T extends { isDeleted: boolean }>(rows: T[]) => rows.filter((r) => !r.isDeleted);

export const firstName = (name: string) => name.split(" ")[0];

/** Ids of users who may approve expenses / see payments (for fan-out notifications). */
export async function usersWithPerm(repos: Repositories, perm: Parameters<typeof can>[1]): Promise<User[]> {
  return (await repos.users.findAll()).filter((u) => u.active && !u.isDeleted && can(u.role, perm));
}

export async function getProjectOrThrow(repos: Repositories, id: string) {
  const p = await repos.projects.findById(id);
  if (!p || p.isDeleted) throw notFound("Project");
  return p;
}

export async function userName(repos: Repositories, id: string | null | undefined) {
  if (!id) return "Unassigned";
  return (await repos.users.findById(id))?.name ?? id;
}

export function assertSelfOr(actor: Actor, ownerId: string, perm: Parameters<typeof can>[1]) {
  if (actor.id !== ownerId && !can(actor.role, perm)) throw forbidden();
}
