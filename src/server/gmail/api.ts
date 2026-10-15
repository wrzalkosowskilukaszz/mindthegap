/** Minimal Gmail REST client (https://developers.google.com/gmail/api/reference/rest). */
import { httpFetch } from "../providers/http.ts";
import { accessToken, GmailAuthError } from "./oauth.ts";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public kind: "rate_limited" | "auth" | "invalid" | "server" | "network",
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { token } = await accessToken();
  let res: Response;
  try {
    res = await httpFetch(`${BASE}${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` }, timeoutMs: init.timeoutMs ?? 30_000 });
  } catch (e) {
    throw new GmailApiError(`network: ${e instanceof Error ? e.message : String(e)}`, 0, "network");
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T & { error?: { message?: string; errors?: { reason?: string }[] } }) : ({} as T & { error?: { message?: string; errors?: { reason?: string }[] } });
  if (res.ok) return data;
  const reason = data.error?.errors?.[0]?.reason ?? "";
  const msg = data.error?.message ?? `HTTP ${res.status}`;
  if (res.status === 429 || /rateLimitExceeded|userRateLimitExceeded|quotaExceeded/.test(reason)) throw new GmailApiError(msg, res.status, "rate_limited");
  if (res.status === 401) throw new GmailAuthError(`Gmail: ${msg}`, true);
  if (res.status === 403) throw new GmailApiError(`Brak uprawnień Gmail: ${msg}`, 403, "auth");
  if (res.status >= 500) throw new GmailApiError(msg, res.status, "server");
  throw new GmailApiError(msg, res.status, "invalid");
}

export type SendResult = { id: string; threadId: string; labelIds?: string[] };

/** Simple upload is fine up to 5 MB request size; attachments are limited accordingly by the app. */
export function sendRaw(raw: string, threadId?: string | null): Promise<SendResult> {
  return call<SendResult>("/messages/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ raw, ...(threadId ? { threadId } : {}) }),
    timeoutMs: 60_000,
  });
}

export type Header = { name: string; value: string };
export type MetaMessage = { id: string; threadId: string; labelIds?: string[]; internalDate?: string; payload?: { headers?: Header[]; mimeType?: string } };

const META_HEADERS = ["From", "To", "Date", "Subject", "Message-ID", "In-Reply-To", "References", "Auto-Submitted", "Precedence", "X-Autoreply", "X-Autorespond", "Content-Type", "X-Failed-Recipients"];

export function getThreadMetadata(threadId: string): Promise<{ id: string; historyId?: string; messages?: MetaMessage[] }> {
  const q = META_HEADERS.map((h) => `metadataHeaders=${encodeURIComponent(h)}`).join("&");
  return call(`/threads/${encodeURIComponent(threadId)}?format=metadata&${q}`);
}

export function getMessageMetadata(id: string): Promise<MetaMessage> {
  const q = META_HEADERS.map((h) => `metadataHeaders=${encodeURIComponent(h)}`).join("&");
  return call(`/messages/${encodeURIComponent(id)}?format=metadata&${q}`);
}

export function listSent(maxResults = 25): Promise<{ messages?: { id: string; threadId: string }[] }> {
  return call(`/messages?labelIds=SENT&maxResults=${maxResults}`);
}

export function header(m: MetaMessage, name: string): string | null {
  return m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

export function openInGmailUrl(email: string | null, threadId: string): string {
  // Unofficial deep link (docs/research/GMAIL.md §7).
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(email ?? "")}#all/${encodeURIComponent(threadId)}`;
}

export function gmailSearchUrl(email: string | null, query: string): string {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(email ?? "")}#search/${encodeURIComponent(query)}`;
}
