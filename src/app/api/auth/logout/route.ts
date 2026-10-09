import { NextResponse } from "next/server";
import { route } from "@/utils/api";
import { SESSION_COOKIE } from "@/utils/session";

export const POST = route(async () => {
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}, { public: true });
