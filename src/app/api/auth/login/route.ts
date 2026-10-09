import { NextResponse } from "next/server";
import { LoginInput } from "@/schemas/inputs";
import { parse } from "@/utils/validate";
import { route } from "@/utils/api";
import { SESSION_COOKIE } from "@/utils/session";
import { cookieOptions, sessionTokenFor } from "@/utils/auth";
import { toPublic } from "@/modules/users/user.service";

export const POST = route(
  async ({ svc, body }) => {
    const { email, password } = parse(LoginInput, await body());
    const user = await svc.auth.login(email, password);
    const res = NextResponse.json({ data: toPublic(user) });
    res.cookies.set(SESSION_COOKIE, await sessionTokenFor(user), cookieOptions);
    return res;
  },
  { public: true },
);
