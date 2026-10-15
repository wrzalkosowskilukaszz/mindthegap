/** Replaceable provider adapters for contact sourcing, verification and web search. */
import type { EmailStatus } from "@/lib/contact-rules";

export class ProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public retryable: boolean,
    public status?: number,
  ) {
    super(message);
  }
}

export class RateLimitedError extends ProviderError {
  constructor(provider: string, public retryAfterMs: number) {
    super(provider, "rate limited", true, 429);
  }
}

export type VerificationResult = {
  provider: string;
  status: EmailStatus;
  providerStatus: string;
  score: number | null;
  raw: unknown;
  /** Paid units consumed (provider credits). */
  credits: number;
  /** Still processing on the provider side; try again later. */
  pending?: boolean;
};

export interface EmailVerifier {
  readonly name: string;
  readonly paid: boolean;
  readonly creditsPerCall: number;
  verify(email: string): Promise<VerificationResult>;
}

export type ProviderSource = { uri: string; extractedOn?: string | null; lastSeenOn?: string | null; stillOnPage?: boolean | null };

export type ProviderContact = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  department: string | null;
  seniority: string | null;
  confidence: number | null;
  type: "personal" | "generic" | null;
  sources: ProviderSource[];
  verification: { status: string | null; date: string | null } | null;
  providerRef: string;
  raw: unknown;
};

export interface ContactSource {
  readonly name: string;
  readonly creditsPerDomainSearch: number;
  readonly creditsPerFinder: number;
  domainSearch(domain: string, opts: { departments?: string[]; seniority?: string[]; limit?: number }): Promise<{ contacts: ProviderContact[]; pattern: string | null; credits: number; raw: unknown }>;
  emailFinder(domain: string, firstName: string, lastName: string): Promise<{ contact: ProviderContact | null; credits: number }>;
}

export type SearchResult = { url: string; title: string; snippet: string; age?: string | null };

export interface WebSearch {
  readonly name: string;
  readonly creditsPerQuery: number;
  search(query: string, opts?: { count?: number; country?: string; lang?: string }): Promise<SearchResult[]>;
}
