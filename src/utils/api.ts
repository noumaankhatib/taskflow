import { NextRequest, NextResponse } from "next/server";
import { getServices, type Services } from "@/services/container";
import { AppError, fromZod, invalid, unauthorized, forbidden, isAppError, isZodError } from "./errors";
import { logger } from "./logger";
import { SESSION_COOKIE, readSession } from "./session";
import type { Actor } from "./rbac";
import type { Paged } from "./query";
import type { User } from "@/schemas/entities";
import { seedIfNeeded } from "@/seed/auto";

export interface Ctx<P = Record<string, string>> {
  req: NextRequest;
  sp: URLSearchParams;
  params: P;
  svc: Services;
  user: User;
  actor: Actor;
  /** Parse the JSON body (400 on malformed JSON). */
  body: () => Promise<unknown>;
}

export const ok = (data: unknown, status = 200) => NextResponse.json({ data }, { status });
export const created = (data: unknown) => ok(data, 201);
export const paged = <T>(p: Paged<T>, extra?: Record<string, unknown>) =>
  NextResponse.json({ data: p.data, meta: { ...p.meta, ...extra } });
export const noContent = () => new NextResponse(null, { status: 204 });

export function errorResponse(err: unknown) {
  let e: AppError;
  if (isAppError(err)) e = err;
  else if (isZodError(err)) e = fromZod(err);
  else {
    // unexpected: log everything, tell the client nothing
    logger.error("Unhandled API error", err);
    e = new AppError("INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
  if (e.status >= 500) logger.error(`${e.code}: ${e.message}`, e.details ?? "");
  return NextResponse.json(
    { error: { code: e.code, message: e.message, ...(e.code === "VALIDATION_ERROR" && e.details ? { details: e.details } : {}) } },
    { status: e.status },
  );
}

interface Options {
  /** Skip authentication (login only). */
  public?: boolean;
}

type Handler<P> = (ctx: Ctx<P>) => Promise<Response | unknown>;

/** Wraps a route handler: session auth, CSRF origin check, JSON error mapping. */
export function route<P = Record<string, string>>(fn: Handler<P>, opts: Options = {}) {
  return async (req: NextRequest, rc: { params: Promise<P> }): Promise<Response> => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      await seedIfNeeded();
      const svc = getServices();
      const params = (await rc.params) ?? ({} as P);
      let user: User | null = null;
      if (!opts.public) {
        user = await svc.auth.userFromSession(await readSession(req.cookies.get(SESSION_COOKIE)?.value));
        if (!user) throw unauthorized();
      }
      const ctx = {
        req, sp: req.nextUrl.searchParams, params, svc, user: user as User,
        actor: user ? { id: user.id, name: user.name, role: user.role } : (undefined as unknown as Actor),
        body: async () => {
          try {
            return await req.json();
          } catch {
            throw invalid("Request body must be valid JSON.");
          }
        },
      } satisfies Ctx<P>;
      const result = await fn(ctx);
      return result instanceof Response ? result : ok(result);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, tests); cookies are SameSite=Lax anyway
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (new URL(origin).host !== host) throw forbidden("Cross-origin request blocked.");
}
