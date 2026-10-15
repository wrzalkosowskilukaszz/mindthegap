/**
 * Hunter.io adapter (API v2). Docs: https://hunter.io/api-documentation/v2
 * - Domain Search returns emails with the public source URLs where they were found. 1 credit per email
 *   returned, so `limit` caps spend (docs/research/PROVIDERS.md §3.2).
 * - Email Finder: by default the found-only endpoint (`/email-finder/found`), which never returns
 *   pattern-generated addresses. A result without sources is marked "provider_pattern" anyway.
 * - Email Verifier: 0.5 credit, free when the result is `unknown`. Statuses: valid | invalid | accept_all |
 *   webmail | disposable | unknown (HTTP 202 = still running).
 * The original provider payload is always kept.
 */
import type { EmailStatus } from "@/lib/contact-rules";
import { providerJson } from "./http.ts";
import {
  type ContactSource,
  type EmailVerifier,
  type ProviderContact,
  ProviderError,
  type VerificationResult,
} from "./types.ts";

const BASE = "https://api.hunter.io/v2";

type HunterEmail = {
  value: string;
  type: "personal" | "generic" | null;
  confidence: number | null;
  sources?: {
    domain?: string;
    uri: string;
    extracted_on?: string;
    last_seen_on?: string;
    still_on_page?: boolean;
  }[];
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  seniority: string | null;
  department: string | null;
  verification?: { date: string | null; status: string | null } | null;
};

export function mapHunterStatus(s: string | null | undefined): EmailStatus {
  switch (s) {
    case "valid":
      return "valid";
    case "invalid":
      return "invalid";
    case "accept_all":
      return "catch_all";
    case "webmail":
    case "disposable":
    case "unknown":
      return "unknown";
    default:
      return "unknown";
  }
}

function toContact(e: HunterEmail, ref: string): ProviderContact {
  return {
    email: e.value ?? null,
    firstName: e.first_name,
    lastName: e.last_name,
    position: e.position,
    department: e.department,
    seniority: e.seniority,
    confidence: e.confidence,
    type: e.type,
    sources: (e.sources ?? []).map((s) => ({
      uri: s.uri,
      extractedOn: s.extracted_on ?? null,
      lastSeenOn: s.last_seen_on ?? null,
      stillOnPage: s.still_on_page ?? null,
    })),
    verification: e.verification ? { status: e.verification.status, date: e.verification.date } : null,
    providerRef: ref,
    raw: e,
  };
}

export class HunterClient implements ContactSource, EmailVerifier {
  readonly name = "hunter";
  readonly paid = true;
  readonly creditsPerCall = 0.5;
  readonly creditsPerDomainSearch: number;
  readonly creditsPerFinder = 1;
  constructor(
    private apiKey: string,
    private opts: { domainSearchLimit?: number; foundOnly?: boolean } = {},
  ) {
    this.creditsPerDomainSearch = opts.domainSearchLimit ?? 3;
  }

  private url(path: string, params: Record<string, string | number | undefined>): string {
    const u = new URL(`${BASE}/${path}`);
    for (const [k, v] of Object.entries(params))
      if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
    return u.toString();
  }

  private get headers() {
    return { "X-API-KEY": this.apiKey, Accept: "application/json" };
  }

  async domainSearch(domain: string, opts: { departments?: string[]; seniority?: string[]; limit?: number }) {
    const { status, data } = await providerJson<{
      data?: { emails: HunterEmail[]; pattern: string | null };
      errors?: { details: string }[];
    }>(
      this.name,
      this.url("domain-search", {
        domain,
        department: opts.departments?.join(","),
        seniority: opts.seniority?.join(","),
        type: "personal",
        limit: opts.limit ?? this.opts.domainSearchLimit ?? 3,
      }),
      { headers: this.headers },
    );
    if (status >= 400)
      throw new ProviderError(this.name, data.errors?.[0]?.details ?? `HTTP ${status}`, false, status);
    const emails = data.data?.emails ?? [];
    return {
      contacts: emails.map((e) => toContact(e, `domain-search:${domain}:${e.value}`)),
      pattern: data.data?.pattern ?? null,
      credits: emails.length, // 1 credit per email returned; none when nothing is found

      raw: { pattern: data.data?.pattern ?? null, count: emails.length },
    };
  }

  async emailFinder(domain: string, firstName: string, lastName: string) {
    const { status, data } = await providerJson<{
      data?: HunterEmail & { email: string | null; score: number | null };
      errors?: { details: string }[];
    }>(
      this.name,
      this.url(this.opts.foundOnly === false ? "email-finder" : "email-finder/found", {
        domain,
        first_name: firstName,
        last_name: lastName,
      }),
      { headers: this.headers },
    );
    if (status === 404 || !data.data?.email) return { contact: null, credits: 0 };
    if (status >= 400)
      throw new ProviderError(this.name, data.errors?.[0]?.details ?? `HTTP ${status}`, false, status);
    const d = data.data;
    const c = toContact(
      { ...d, value: d.email!, confidence: d.score ?? d.confidence },
      `email-finder:${domain}:${firstName}:${lastName}`,
    );
    return { contact: c, credits: 1 };
  }

  async verify(email: string): Promise<VerificationResult> {
    const { status, data } = await providerJson<{
      data?: { status: string; result?: string; score?: number };
      errors?: { details: string }[];
    }>(this.name, this.url("email-verifier", { email }), { timeoutMs: 40_000, headers: this.headers });
    if (status === 202)
      return {
        provider: this.name,
        status: "unknown",
        providerStatus: "pending",
        score: null,
        raw: data,
        credits: 0,
        pending: true,
      };
    if (status >= 400)
      throw new ProviderError(
        this.name,
        data.errors?.[0]?.details ?? `HTTP ${status}`,
        status !== 400,
        status,
      );
    const d = data.data!;
    return {
      provider: this.name,
      status: mapHunterStatus(d.status),
      providerStatus: d.status,
      score: d.score ?? null,
      raw: data.data,
      credits: d.status === "unknown" ? 0 : 0.5,
    };
  }

  async account(): Promise<unknown> {
    const { data } = await providerJson<{ data?: unknown }>(this.name, this.url("account", {}), {
      headers: this.headers,
    });
    return data.data ?? null;
  }
}
