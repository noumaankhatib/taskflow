import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "STORAGE_ERROR"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  STORAGE_ERROR: 500,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}

/**
 * Class identity is NOT reliable in bundled builds (the same module can be instantiated once per server
 * chunk), so errors are recognised by their shape rather than `instanceof`.
 */
export function isAppError(e: unknown): e is AppError {
  return (
    e instanceof AppError ||
    (typeof e === "object" && e !== null && (e as Error).name === "AppError" && typeof (e as AppError).status === "number" && typeof (e as AppError).code === "string")
  );
}
export function isZodError(e: unknown): e is ZodError {
  return e instanceof ZodError || (typeof e === "object" && e !== null && (e as Error).name === "ZodError" && Array.isArray((e as ZodError).issues));
}

export const notFound = (what = "Record") => new AppError("NOT_FOUND", `${what} not found.`);
export const forbidden = (msg = "User does not have permission to perform this action.") =>
  new AppError("FORBIDDEN", msg);
export const unauthorized = (msg = "Please sign in to continue.") => new AppError("UNAUTHORIZED", msg);
export const invalid = (msg: string, details?: unknown) => new AppError("VALIDATION_ERROR", msg, details);
export const conflict = (msg: string) => new AppError("CONFLICT", msg);

/** Convert a ZodError into a friendly AppError (first issue as message, all issues as details). */
export function fromZod(err: ZodError): AppError {
  const issues = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  const first = issues[0];
  const msg = first ? (first.path ? `${labelize(first.path)}: ${first.message}` : first.message) : "Invalid input.";
  return new AppError("VALIDATION_ERROR", msg, issues);
}

function labelize(path: string) {
  const last = path.split(".").pop() ?? path;
  return last.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}
