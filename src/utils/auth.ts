import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServices } from "@/services/container";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, passwordFingerprint, readSession, signSession } from "./session";
import { toPublic } from "@/modules/users/user.service";
import { seedIfNeeded } from "@/seed/auto";
import type { PublicUser, User } from "@/schemas/entities";

/** For server components / layouts. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  await seedIfNeeded();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await getServices().auth.userFromSession(await readSession(token));
  return user ? toPublic(user) : null;
}

export async function requireUser(): Promise<PublicUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

export async function sessionTokenFor(user: User) {
  return signSession({ uid: user.id, v: passwordFingerprint(user.passwordHash) });
}
