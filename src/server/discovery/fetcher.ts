/**
 * Polite, bounded fetcher for public company pages.
 * - Identifies itself honestly (User-Agent with contact URL).
 * - Obeys robots.txt (cached 24 h; 5xx/unreachable robots → treat as disallowed, 4xx → allowed).
 * - Per-host minimum delay (and robots Crawl-delay, capped), manual redirects re-checked against robots.
 * - Only HTML (and sitemap XML), size-capped; never follows logins, forms, CAPTCHAs or paywalls.
 */
import robotsParser from "robots-parser";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { fetchLog, hostState } from "../db/schema.ts";
import { env } from "../env.ts";
import { httpFetch } from "../providers/http.ts";

export type FetchOutcome =
  | { ok: true; url: string; status: number; body: string; contentType: string }
  | { ok: false; url: string; reason: "robots_disallowed" | "http_error" | "network_error" | "skipped_type" | "too_large" | "redirect_loop"; status?: number; detail?: string };

const UA_TOKEN = "MindTheGapOutreachBot";
const ROBOTS_TTL_MS = 24 * 3_600_000;

export class PoliteFetcher {
  private robotsCache = new Map<string, ReturnType<typeof robotsParser> | "disallow_all" | "allow_all">();
  private lastHit = new Map<string, number>();
  readonly userAgent: string;
  pagesFetched = 0;

  constructor(
    private opts: { minDelayMs: number; runId?: string | null; maxBytes?: number; timeoutMs?: number },
  ) {
    this.userAgent = `Mozilla/5.0 (compatible; ${UA_TOKEN}/1.0; +${env().CRAWLER_CONTACT_URL}) research of public business contact pages`;
  }

  private async robotsFor(origin: string): Promise<ReturnType<typeof robotsParser> | "disallow_all" | "allow_all"> {
    const cached = this.robotsCache.get(origin);
    if (cached) return cached;
    const host = new URL(origin).host;
    const [st] = await db().select().from(hostState).where(eq(hostState.host, host)).limit(1);
    let txt: string | null = null;
    let status: number | null = null;
    if (st?.robotsFetchedAt && Date.now() - st.robotsFetchedAt.getTime() < ROBOTS_TTL_MS) {
      txt = st.robotsTxt;
      status = st.robotsStatus;
    } else {
      await this.wait(host);
      try {
        const res = await httpFetch(`${origin}/robots.txt`, { headers: { "User-Agent": this.userAgent }, timeoutMs: 12_000, redirect: "follow" });
        status = res.status;
        txt = res.ok ? (await res.text()).slice(0, 200_000) : null;
      } catch {
        status = 0;
      }
      this.lastHit.set(host, Date.now());
      await db()
        .insert(hostState)
        .values({ host, robotsTxt: txt, robotsStatus: status, robotsFetchedAt: new Date(), lastFetchAt: new Date() })
        .onConflictDoUpdate({ target: hostState.host, set: { robotsTxt: txt, robotsStatus: status, robotsFetchedAt: new Date(), lastFetchAt: new Date() } });
    }
    let r: ReturnType<typeof robotsParser> | "disallow_all" | "allow_all";
    if (status === null || status === 0 || status >= 500) r = "disallow_all";
    else if (status >= 400 || !txt) r = "allow_all";
    else r = robotsParser(`${origin}/robots.txt`, txt);
    this.robotsCache.set(origin, r);
    return r;
  }

  async allowed(url: string): Promise<boolean> {
    const u = new URL(url);
    const r = await this.robotsFor(u.origin);
    if (r === "allow_all") return true;
    if (r === "disallow_all") return false;
    return r.isAllowed(url, UA_TOKEN) !== false;
  }

  async sitemapsFromRobots(origin: string): Promise<string[]> {
    const r = await this.robotsFor(origin);
    return typeof r === "object" ? r.getSitemaps() : [];
  }

  private crawlDelayMs(host: string): number {
    for (const [origin, r] of this.robotsCache) {
      if (typeof r === "object" && new URL(origin).host === host) {
        const d = r.getCrawlDelay(UA_TOKEN);
        if (d) return Math.min(d * 1000, 30_000);
      }
    }
    return 0;
  }

  private async wait(host: string) {
    const gap = Math.max(this.opts.minDelayMs, this.crawlDelayMs(host));
    const last = this.lastHit.get(host) ?? 0;
    const delta = Date.now() - last;
    if (delta < gap) await new Promise((r) => setTimeout(r, gap - delta));
  }

  async get(url: string, kind: "html" | "xml" = "html"): Promise<FetchOutcome> {
    let current = url;
    for (let hop = 0; hop < 5; hop++) {
      const u = new URL(current);
      if (!(await this.allowed(current))) {
        await this.log(current, null, "robots_disallowed");
        return { ok: false, url: current, reason: "robots_disallowed" };
      }
      await this.wait(u.host);
      let res: Response;
      try {
        res = await httpFetch(current, {
          redirect: "manual",
          timeoutMs: this.opts.timeoutMs ?? 15_000,
          headers: {
            "User-Agent": this.userAgent,
            Accept: kind === "xml" ? "application/xml,text/xml;q=0.9,*/*;q=0.1" : "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
            "Accept-Language": "pl,en;q=0.8",
          },
        });
      } catch (e) {
        this.lastHit.set(u.host, Date.now());
        await this.log(current, null, "network_error");
        return { ok: false, url: current, reason: "network_error", detail: e instanceof Error ? e.message : String(e) };
      }
      this.lastHit.set(u.host, Date.now());
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, current).toString();
        continue;
      }
      if (!res.ok) {
        await this.log(current, res.status, "http_error");
        return { ok: false, url: current, reason: "http_error", status: res.status };
      }
      const ct = res.headers.get("content-type") ?? "";
      const okType = kind === "xml" ? /xml|text\/plain/.test(ct) : /html|xhtml/.test(ct);
      if (!okType) {
        await this.log(current, res.status, "skipped_type");
        return { ok: false, url: current, reason: "skipped_type", status: res.status, detail: ct };
      }
      const max = this.opts.maxBytes ?? 1_500_000;
      const body = await readCapped(res, max);
      if (body === null) {
        await this.log(current, res.status, "too_large");
        return { ok: false, url: current, reason: "too_large" };
      }
      this.pagesFetched++;
      await this.log(current, res.status, "ok", body.length);
      return { ok: true, url: current, status: res.status, body, contentType: ct };
    }
    return { ok: false, url: current, reason: "redirect_loop" };
  }

  private async log(url: string, status: number | null, outcome: string, bytes?: number) {
    try {
      await db()
        .insert(fetchLog)
        .values({ url: url.slice(0, 2000), host: new URL(url).host, status, outcome, bytes: bytes ?? null, runId: this.opts.runId ?? null });
    } catch {
      /* logging must never break a crawl */
    }
  }
}

async function readCapped(res: Response, max: number): Promise<string | null> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}
