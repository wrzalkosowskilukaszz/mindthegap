/**
 * Google OAuth for Gmail (authorization code + PKCE, server-side, tokens encrypted at rest).
 * Permissions are requested separately (incremental authorization, docs/research/GMAIL.md):
 *   - "send":  openid email + gmail.send            (sensitive)
 *   - "read":  gmail.metadata (headers only, no bodies; restricted) for reply tracking and send reconciliation
 * We never request the Gmail password and never request full-mailbox read access.
 */
import { createHash } from "node:crypto";
import { desc, eq, lt } from "drizzle-orm";
import { decryptSecret, encryptSecret, randomToken } from "../crypto.ts";
import { db } from "../db/client.ts";
import { googleAccounts, oauthStates } from "../db/schema.ts";
import { env } from "../env.ts";
import { logEvent } from "../events.ts";
import { httpFetch } from "../providers/http.ts";

export const SCOPE_SEND = "https://www.googleapis.com/auth/gmail.send";
export const SCOPE_METADATA = "https://www.googleapis.com/auth/gmail.metadata";
const SCOPES: Record<"send" | "read", string[]> = {
  send: ["openid", "email", SCOPE_SEND],
  read: ["openid", "email", SCOPE_METADATA],
};

export class GmailAuthError extends Error {
  constructor(
    message: string,
    public needsReauth: boolean,
  ) {
    super(message);
  }
}

function redirectUri(): string {
  return `${env().APP_URL.replace(/\/$/, "")}/api/google/callback`;
}

export async function currentAccount() {
  const [a] = await db().select().from(googleAccounts).orderBy(desc(googleAccounts.connectedAt)).limit(1);
  return a ?? null;
}

export async function authorizationUrl(purpose: "send" | "read"): Promise<string> {
  const e = env();
  if (!e.GOOGLE_CLIENT_ID || !e.GOOGLE_CLIENT_SECRET)
    throw new GmailAuthError(
      "Brak konfiguracji Google OAuth (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
      false,
    );
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  await db()
    .delete(oauthStates)
    .where(lt(oauthStates.createdAt, new Date(Date.now() - 30 * 60_000)));
  await db().insert(oauthStates).values({ state, codeVerifier: verifier, purpose });
  const acct = await currentAccount();
  const p = new URLSearchParams({
    client_id: e.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES[purpose].join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  if (acct?.email) p.set("login_hint", acct.email);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await httpFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    timeoutMs: 20_000,
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    const needsReauth = data.error === "invalid_grant" || data.error === "unauthorized_client";
    throw new GmailAuthError(
      `Google OAuth: ${data.error ?? res.status}${data.error_description ? ` (${data.error_description})` : ""}`,
      needsReauth,
    );
  }
  return data;
}

function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    // Received directly from Google's token endpoint over TLS; the payload is only used for display/login_hint.
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      email?: string;
    };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

export async function handleCallback(
  code: string,
  state: string,
): Promise<{ email: string; scopes: string[] }> {
  const e = env();
  const [st] = await db().select().from(oauthStates).where(eq(oauthStates.state, state)).limit(1);
  if (!st || Date.now() - st.createdAt.getTime() > 30 * 60_000)
    throw new GmailAuthError("Nieprawidłowy lub wygasły stan autoryzacji. Spróbuj ponownie.", false);
  await db().delete(oauthStates).where(eq(oauthStates.state, state));
  const t = await tokenRequest({
    code,
    client_id: e.GOOGLE_CLIENT_ID!,
    client_secret: e.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
    code_verifier: st.codeVerifier,
  });
  const scopes = t.scope.split(" ").filter(Boolean);
  const email = emailFromIdToken(t.id_token);
  const acct = await currentAccount();
  if (acct && email && acct.email !== email) {
    throw new GmailAuthError(
      `Połączone konto to ${acct.email}. Najpierw rozłącz je w Ustawieniach, aby połączyć ${email}.`,
      false,
    );
  }
  const values = {
    email: email ?? acct?.email ?? "nieznany",
    scopes,
    accessTokenEnc: encryptSecret(t.access_token),
    accessTokenExpiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000),
    ...(t.refresh_token ? { refreshTokenEnc: encryptSecret(t.refresh_token) } : {}),
    status: "connected",
    statusDetail: null,
    updatedAt: new Date(),
  };
  if (acct) await db().update(googleAccounts).set(values).where(eq(googleAccounts.id, acct.id));
  else await db().insert(googleAccounts).values(values);
  // Google may grant only some of the requested scopes (granular consent): report what we actually have.
  await logEvent(
    "info",
    "gmail",
    `Gmail połączony (${values.email}); uprawnienia: ${
      scopes
        .filter((s) => s.includes("gmail"))
        .map((s) => s.split("/").pop())
        .join(", ") || "brak Gmaila"
    }`,
  );
  return { email: values.email, scopes };
}

/** A valid access token, refreshing when needed. Marks the account "needs_reauth" on invalid_grant. */
export async function accessToken(): Promise<{
  token: string;
  account: NonNullable<Awaited<ReturnType<typeof currentAccount>>>;
}> {
  const acct = await currentAccount();
  if (!acct || acct.status === "disconnected") throw new GmailAuthError("Gmail nie jest połączony.", true);
  if (acct.status === "needs_reauth") throw new GmailAuthError("Gmail wymaga ponownej autoryzacji.", true);
  if (
    acct.accessTokenEnc &&
    acct.accessTokenExpiresAt &&
    acct.accessTokenExpiresAt.getTime() > Date.now() + 30_000
  ) {
    return { token: decryptSecret(acct.accessTokenEnc), account: acct };
  }
  if (!acct.refreshTokenEnc) {
    await markNeedsReauth(acct.id, "Brak tokenu odświeżania");
    throw new GmailAuthError("Gmail wymaga ponownej autoryzacji (brak tokenu odświeżania).", true);
  }
  try {
    const t = await tokenRequest({
      client_id: env().GOOGLE_CLIENT_ID!,
      client_secret: env().GOOGLE_CLIENT_SECRET!,
      refresh_token: decryptSecret(acct.refreshTokenEnc),
      grant_type: "refresh_token",
    });
    await db()
      .update(googleAccounts)
      .set({
        accessTokenEnc: encryptSecret(t.access_token),
        accessTokenExpiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000),
        ...(t.scope ? { scopes: t.scope.split(" ").filter(Boolean) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(googleAccounts.id, acct.id));
    return {
      token: t.access_token,
      account: { ...acct, scopes: t.scope ? t.scope.split(" ") : acct.scopes },
    };
  } catch (e) {
    if (e instanceof GmailAuthError && e.needsReauth) await markNeedsReauth(acct.id, e.message);
    throw e;
  }
}

async function markNeedsReauth(id: string, detail: string) {
  await db()
    .update(googleAccounts)
    .set({ status: "needs_reauth", statusDetail: detail.slice(0, 300), updatedAt: new Date() })
    .where(eq(googleAccounts.id, id));
  await logEvent(
    "error",
    "gmail",
    "Gmail wymaga ponownej autoryzacji — wysyłka i synchronizacja wstrzymane.",
    { detail: detail.slice(0, 200) },
  );
}

export async function disconnect(): Promise<void> {
  const acct = await currentAccount();
  if (!acct) return;
  const token = acct.refreshTokenEnc
    ? decryptSecret(acct.refreshTokenEnc)
    : acct.accessTokenEnc
      ? decryptSecret(acct.accessTokenEnc)
      : null;
  if (token) {
    await httpFetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
      timeoutMs: 15_000,
    }).catch(() => null);
  }
  await db()
    .update(googleAccounts)
    .set({
      status: "disconnected",
      refreshTokenEnc: null,
      accessTokenEnc: null,
      accessTokenExpiresAt: null,
      scopes: [],
      statusDetail: "Rozłączono",
      updatedAt: new Date(),
    })
    .where(eq(googleAccounts.id, acct.id));
}

export function hasScope(scopes: string[], scope: string): boolean {
  return scopes.includes(scope);
}
