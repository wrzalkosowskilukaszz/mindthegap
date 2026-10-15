/**
 * Single-owner authentication: a password (scrypt hash in APP_PASSWORD_HASH) and an opaque,
 * server-side session (only the SHA-256 of the token is stored). Login attempts are rate limited.
 */
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomToken, sha256Hex, verifyPassword } from "../crypto.ts";
import { db } from "../db/client.ts";
import { loginAttempts, sessions } from "../db/schema.ts";
import { env } from "../env.ts";

export const SESSION_COOKIE = "mtg_session";
const SESSION_DAYS = 30;
const MAX_FAILED_PER_15_MIN = 8;

function ipHash(ip: string): string {
  return sha256Hex(`${env().SESSION_SECRET}:${ip}`).slice(0, 32);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export type LoginResult = { ok: true } | { ok: false; error: "not_configured" | "invalid" | "rate_limited" };

export async function login(password: string): Promise<LoginResult> {
  const stored = env().APP_PASSWORD_HASH;
  if (!stored) return { ok: false, error: "not_configured" };
  const ip = ipHash(await clientIp());
  const since = new Date(Date.now() - 15 * 60_000);
  const [row] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(
      and(eq(loginAttempts.ipHash, ip), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)),
    );
  if ((row?.n ?? 0) >= MAX_FAILED_PER_15_MIN) return { ok: false, error: "rate_limited" };

  const ok = verifyPassword(password, stored);
  await db().insert(loginAttempts).values({ ipHash: ip, success: ok });
  if (!ok) return { ok: false, error: "invalid" };

  const token = randomToken(32);
  const h = await headers();
  await db()
    .insert(sessions)
    .values({
      id: sha256Hex(token),
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
      userAgent: h.get("user-agent")?.slice(0, 200) ?? null,
    });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env().APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  // housekeeping
  await db().delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db()
    .delete(loginAttempts)
    .where(lt(loginAttempts.createdAt, new Date(Date.now() - 7 * 86_400_000)));
  return { ok: true };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token)
    await db()
      .delete(sessions)
      .where(eq(sessions.id, sha256Hex(token)));
  jar.delete(SESSION_COOKIE);
}

export async function hasValidSession(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const id = sha256Hex(token);
  const [s] = await db().select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!s || s.expiresAt.getTime() < Date.now()) return false;
  if (Date.now() - s.lastSeenAt.getTime() > 10 * 60_000) {
    await db().update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, id));
  }
  return true;
}

/** For server components / layouts: redirect to /login when not signed in. */
export async function requireSession(): Promise<void> {
  if (!(await hasValidSession())) redirect("/login");
}

export class UnauthorizedError extends Error {}

/** For route handlers and server actions: also enforces same-origin for state-changing requests. */
export async function assertApiSession(method = "GET"): Promise<void> {
  if (!(await hasValidSession())) throw new UnauthorizedError("unauthorized");
  if (method !== "GET" && method !== "HEAD") {
    const h = await headers();
    const origin = h.get("origin");
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (origin && host && new URL(origin).host !== host) throw new UnauthorizedError("cross-origin");
  }
}
