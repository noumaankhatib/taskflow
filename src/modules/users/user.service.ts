import bcrypt from "bcryptjs";
import type { Deps } from "@/services/shared";
import { alive } from "@/services/shared";
import type { PublicUser, User } from "@/schemas/entities";
import {
  ChangePasswordInput, ResetPasswordInput, UserCreateInput, UserUpdateInput,
} from "@/schemas/inputs";
import { parse } from "@/utils/validate";
import { can, requirePerm, type Actor } from "@/utils/rbac";
import { conflict, forbidden, invalid, notFound, unauthorized } from "@/utils/errors";
import { matchesText } from "@/utils/query";
import { passwordFingerprint } from "@/utils/session";

const BCRYPT_ROUNDS = 10;

export function toPublic(u: User, viewer?: Actor): PublicUser {
  const { passwordHash: _omit, ...rest } = u;
  void _omit;
  // pay rates are sensitive: only finance-ish roles (and the user themself) see them
  if (viewer && viewer.id !== u.id && !can(viewer.role, "rates:view")) return { ...rest, hourlyRate: 0, dailyRate: 0 };
  return rest;
}

/** Hourly cost used for team-cost calculations. Falls back to dailyRate / 8. */
export const effectiveHourlyRate = (u: Pick<User, "hourlyRate" | "dailyRate">) =>
  u.hourlyRate > 0 ? u.hourlyRate : u.dailyRate / 8;

export class UserService {
  constructor(private d: Deps) {}
  private get users() {
    return this.d.repos.users;
  }

  async list(actor: Actor, f: { q?: string; role?: string; active?: boolean; includeDeleted?: boolean } = {}) {
    let rows = f.includeDeleted ? await this.users.findAll() : alive(await this.users.findAll());
    rows = rows.filter(
      (u) =>
        matchesText(f.q, u.name, u.email) &&
        (!f.role || u.role === f.role) &&
        (f.active === undefined || u.active === f.active),
    );
    return rows.sort((a, b) => a.name.localeCompare(b.name)).map((u) => toPublic(u, actor));
  }

  async get(actor: Actor, id: string) {
    const u = await this.users.findById(id);
    if (!u) throw notFound("User");
    return toPublic(u, actor);
  }

  async create(actor: Actor, raw: unknown) {
    requirePerm(actor, "user:manage");
    const input = parse(UserCreateInput, raw);
    await this.assertEmailFree(input.email);
    const { password, ...rest } = input;
    const user = await this.users.create({
      ...rest,
      avatar: null,
      active: true,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    });
    await this.d.activity.log({
      entityType: "USER", entityId: user.id, action: "CREATED", userId: actor.id,
      newValue: { role: user.role }, message: `${actor.name} added team member ${user.name}`,
    });
    return toPublic(user, actor);
  }

  async update(actor: Actor, id: string, raw: unknown) {
    const target = await this.users.findById(id);
    if (!target || target.isDeleted) throw notFound("User");
    const patch = parse(UserUpdateInput, raw);
    const isAdmin = can(actor.role, "user:manage");
    const isSelf = actor.id === id;
    if (!isAdmin && !isSelf) throw forbidden();
    if (!isAdmin) {
      // self-service: only profile fields
      const allowed = new Set(["name", "avatar", "email"]);
      if (Object.keys(patch).some((k) => !allowed.has(k))) throw forbidden();
    }
    if (patch.email && patch.email !== target.email) await this.assertEmailFree(patch.email, id);
    if (isAdmin) await this.guardLastAdmin(target, patch);
    if (isSelf && (patch.active === false || (patch.role && patch.role !== target.role))) {
      throw invalid("You cannot disable your own account or change your own role.");
    }
    const updated = await this.users.update(id, patch);
    const changes: string[] = [];
    if (patch.role && patch.role !== target.role) changes.push(`role ${target.role} → ${patch.role}`);
    if (patch.active !== undefined && patch.active !== target.active) changes.push(patch.active ? "enabled" : "disabled");
    await this.d.activity.log({
      entityType: "USER", entityId: id, action: "UPDATED", userId: actor.id,
      oldValue: { role: target.role, active: target.active }, newValue: { role: updated.role, active: updated.active },
      message: `${actor.name} updated ${updated.name}${changes.length ? ` (${changes.join(", ")})` : ""}`,
    });
    return toPublic(updated, actor);
  }

  async resetPassword(actor: Actor, id: string, raw: unknown) {
    requirePerm(actor, "user:manage");
    const { newPassword } = parse(ResetPasswordInput, raw);
    const u = await this.users.findById(id);
    if (!u || u.isDeleted) throw notFound("User");
    await this.users.update(id, { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) });
    await this.d.activity.log({
      entityType: "USER", entityId: id, action: "UPDATED", userId: actor.id,
      message: `${actor.name} reset access for ${u.name}`,
    });
  }

  /** Returns the new session fingerprint so the caller can refresh the cookie. */
  async changePassword(actor: Actor, raw: unknown) {
    const { currentPassword, newPassword } = parse(ChangePasswordInput, raw);
    const u = await this.users.findById(actor.id);
    if (!u) throw notFound("User");
    if (!(await bcrypt.compare(currentPassword, u.passwordHash))) throw invalid("Current password is incorrect.");
    const updated = await this.users.update(u.id, { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) });
    return { fingerprint: passwordFingerprint(updated.passwordHash), userId: u.id };
  }

  async softDelete(actor: Actor, id: string) {
    requirePerm(actor, "user:manage");
    if (actor.id === id) throw invalid("You cannot delete your own account.");
    const u = await this.users.findById(id);
    if (!u || u.isDeleted) throw notFound("User");
    await this.guardLastAdmin(u, { active: false });
    await this.users.update(id, { isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: actor.id, active: false });
    await this.d.activity.log({
      entityType: "USER", entityId: id, action: "DELETED", userId: actor.id, message: `${actor.name} removed ${u.name}`,
    });
  }

  async restore(actor: Actor, id: string) {
    requirePerm(actor, "user:manage");
    const u = await this.users.findById(id);
    if (!u || !u.isDeleted) throw notFound("User");
    const restored = await this.users.update(id, { isDeleted: false, deletedAt: null, deletedBy: null, active: true });
    await this.d.activity.log({
      entityType: "USER", entityId: id, action: "RESTORED", userId: actor.id, message: `${actor.name} restored ${u.name}`,
    });
    return toPublic(restored, actor);
  }

  private async assertEmailFree(email: string, exceptId?: string) {
    const clash = (await this.users.findAll()).find((u) => u.email === email && u.id !== exceptId);
    if (clash) throw conflict("A user with this email already exists.");
  }

  private async guardLastAdmin(target: User, patch: { role?: string; active?: boolean }) {
    const losingAdmin =
      target.role === "ADMIN" && target.active && ((patch.role && patch.role !== "ADMIN") || patch.active === false);
    if (!losingAdmin) return;
    const admins = alive(await this.users.findAll()).filter((u) => u.role === "ADMIN" && u.active);
    if (admins.length <= 1) throw invalid("At least one active admin is required.");
  }
}

/* ------------------------------ authentication ------------------------------ */
const attempts = ((globalThis as unknown as { __loginAttempts?: Map<string, { n: number; until: number }> }).__loginAttempts ??=
  new Map());
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;

export class AuthService {
  constructor(private d: Deps) {}

  async login(email: string, password: string) {
    const key = email.toLowerCase();
    const a = attempts.get(key);
    if (a && a.until > Date.now()) throw unauthorized("Too many failed attempts. Try again in a minute.");
    const user = (await this.d.repos.users.find({ email: key })).find((u) => !u.isDeleted);
    // always run bcrypt so timing doesn't reveal whether the email exists
    const ok = await bcrypt.compare(password, user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi");
    if (!user || !ok) {
      const n = (a?.n ?? 0) + 1;
      attempts.set(key, { n, until: n >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0 });
      throw unauthorized("Invalid email or password.");
    }
    if (!user.active) throw unauthorized("This account has been disabled. Contact an administrator.");
    attempts.delete(key);
    return user;
  }

  /** Resolve a session into a live user (re-checked on every request so disabling takes effect immediately). */
  async userFromSession(s: { uid: string; v: string } | null): Promise<User | null> {
    if (!s) return null;
    const u = await this.d.repos.users.findById(s.uid);
    if (!u || u.isDeleted || !u.active) return null;
    if (passwordFingerprint(u.passwordHash) !== s.v) return null;
    return u;
  }
}
