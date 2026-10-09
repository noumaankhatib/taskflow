import { NextResponse } from "next/server";
import { route } from "@/utils/api";
import { SESSION_COOKIE, signSession } from "@/utils/session";
import { cookieOptions } from "@/utils/auth";

export const POST = route(async ({ svc, actor, body }) => {
  const { fingerprint, userId } = await svc.users.changePassword(actor, await body());
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(SESSION_COOKIE, await signSession({ uid: userId, v: fingerprint }), cookieOptions);
  return res;
});
