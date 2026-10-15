import { env } from "../env.ts";
import { DnsMxCheck } from "./dns-check.ts";
import { HunterClient } from "./hunter.ts";
import { TavilySearch } from "./tavily.ts";
import type { ContactSource, EmailVerifier, WebSearch } from "./types.ts";

export function contactSource(opts: { domainSearchLimit?: number; foundOnly?: boolean } = {}): ContactSource | null {
  const k = env().HUNTER_API_KEY;
  return k ? new HunterClient(k, opts) : null;
}

/** Paid verifier when configured, otherwise the free DNS check (which can only detect dead domains). */
export function emailVerifier(): EmailVerifier {
  const k = env().HUNTER_API_KEY;
  return k ? new HunterClient(k) : new DnsMxCheck();
}

export function webSearch(): WebSearch | null {
  const k = env().TAVILY_API_KEY;
  return k ? new TavilySearch(k) : null;
}
