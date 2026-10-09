import type { Role } from "@/schemas/entities";
import { forbidden } from "./errors";

export const PERMISSIONS = [
  "user:manage",     // add/disable users, change roles, reset access
  "client:write",
  "project:write",
  "project:delete",
  "task:write",      // create tasks, edit tasks you own / are assigned to
  "task:manage",     // edit/assign/delete any task
  "time:write",
  "comment:write",
  "expense:write",   // submit expenses (pending approval unless approver)
  "expense:approve",
  "payment:write",
  "finance:view",    // payments, project financials, all expenses
  "report:view",
  "rates:view",      // see hourly/daily rates
  "backup:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MEMBER: Permission[] = ["task:write", "time:write", "comment:write", "expense:write"];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  PROJECT_MANAGER: [
    "client:write", "project:write", "project:delete", "task:write", "task:manage", "time:write", "comment:write",
    "expense:write", "expense:approve", "finance:view", "report:view", "rates:view",
  ],
  DEVELOPER: MEMBER,
  DESIGNER: MEMBER,
  QA: MEMBER,
  FINANCE: [
    "expense:write", "expense:approve", "payment:write", "finance:view", "report:view", "rates:view", "comment:write",
  ],
  VIEWER: [],
};

export const can = (role: Role, perm: Permission) => ROLE_PERMISSIONS[role].includes(perm);

export function assertCan(role: Role, perm: Permission) {
  if (!can(role, perm)) throw forbidden();
}

/** Minimal identity passed through services as the acting user. */
export interface Actor {
  id: string;
  name: string;
  role: Role;
}
export const requirePerm = (actor: Actor, perm: Permission) => assertCan(actor.role, perm);
