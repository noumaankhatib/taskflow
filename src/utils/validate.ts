import type { ZodType } from "zod";
import { fromZod, isZodError } from "./errors";

/** Parse unknown input with a Zod schema, throwing a friendly AppError on failure. */
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (err) {
    if (isZodError(err)) throw fromZod(err);
    throw err;
  }
}
