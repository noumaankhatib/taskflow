import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { paths } from "./config";

export const SESSION_COOKIE = "pt_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

let secretCache: Uint8Array | null = null;
function secret(): Uint8Array {
  if (secretCache) return secretCache;
  let s = process.env.SESSION_SECRET;
  if (!s) {
    const file = path.join(paths.data, ".session-secret");
    try {
      s = fs.readFileSync(file, "utf8").trim();
    } catch {
      s = crypto.randomBytes(32).toString("hex");
      fs.mkdirSync(paths.data, { recursive: true });
      fs.writeFileSync(file, s, { mode: 0o600 });
    }
  }
  return (secretCache = new TextEncoder().encode(s));
}

export interface SessionPayload {
  uid: string;
  /** fingerprint of the password hash: changing/resetting a password invalidates old sessions */
  v: string;
}

export const passwordFingerprint = (hash: string) => hash.slice(-10);

export async function signSession(p: SessionPayload) {
  return new SignJWT({ ...p })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function readSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.uid !== "string" || typeof payload.v !== "string") return null;
    return { uid: payload.uid, v: payload.v };
  } catch {
    return null;
  }
}
