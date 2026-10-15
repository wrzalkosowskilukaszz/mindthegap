/**
 * Free domain mail check (DNS). This is NOT email verification: an existing MX record only shows that the
 * domain can receive mail. It can prove "invalid" (domain cannot receive mail) but never "valid".
 */
import { promises as dns } from "node:dns";
import { emailDomain } from "@/lib/normalize";
import type { EmailVerifier, VerificationResult } from "./types.ts";

export class DnsMxCheck implements EmailVerifier {
  readonly name = "dns-mx";
  readonly paid = false;
  readonly creditsPerCall = 0;

  async verify(email: string): Promise<VerificationResult> {
    const domain = emailDomain(email);
    try {
      const mx = await dns.resolveMx(domain);
      if (mx.length > 0) {
        return {
          provider: this.name,
          status: "unknown",
          providerStatus: "domain_accepts_mail",
          score: null,
          raw: { mx: mx.map((m) => m.exchange).slice(0, 5), note: "MX present; mailbox existence not checked" },
          credits: 0,
        };
      }
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== "ENODATA" && code !== "ENOTFOUND") {
        return { provider: this.name, status: "unknown", providerStatus: `dns_error:${code}`, score: null, raw: { code }, credits: 0 };
      }
      // Implicit MX: a domain with an A record can still accept mail (RFC 5321 §5.1).
      try {
        const a = await dns.resolve4(domain);
        if (a.length) return { provider: this.name, status: "unknown", providerStatus: "no_mx_but_a_record", score: null, raw: { a: a.length }, credits: 0 };
      } catch {
        /* fall through */
      }
      return { provider: this.name, status: "invalid", providerStatus: "domain_cannot_receive_mail", score: null, raw: { code }, credits: 0 };
    }
    return { provider: this.name, status: "invalid", providerStatus: "no_mx", score: null, raw: {}, credits: 0 };
  }
}
