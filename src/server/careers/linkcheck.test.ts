import { describe, expect, it } from "vitest";
import { judgeLink } from "./linkcheck.ts";

const page = (url: string, body: string) =>
  ({ ok: true, url, status: 200, body, contentType: "text/html" }) as const;
const filler = "<p>About us. We build great teams and care about people and growth.</p>".repeat(40);

describe("offer link check", () => {
  it("treats 404 and 410 as dead, other failures as unknown", () => {
    const u = "https://jobs.example.com/job/123";
    expect(judgeLink(u, { ok: false, url: u, reason: "http_error", status: 404 }).status).toBe("dead");
    expect(judgeLink(u, { ok: false, url: u, reason: "http_error", status: 410 }).status).toBe("dead");
    expect(judgeLink(u, { ok: false, url: u, reason: "http_error", status: 403 }).status).toBe("unknown");
    expect(judgeLink(u, { ok: false, url: u, reason: "robots_disallowed" }).status).toBe("unknown");
    expect(judgeLink(u, { ok: false, url: u, reason: "network_error" }).status).toBe("unknown");
  });

  it("spots ads that say they have ended (EN, PL, DE)", () => {
    const u = "https://jobs.example.com/job/123";
    for (const msg of [
      "Sorry, this job is no longer available.",
      "This position has been filled.",
      "This job has expired",
      "We are no longer accepting applications for this role.",
      "Oferta wygasła",
      "To ogłoszenie jest nieaktualne.",
      "Rekrutacja została zakończona.",
      "Diese Stelle ist nicht mehr verfügbar.",
    ])
      expect(judgeLink(u, page(u, `<html><body><h1>${msg}</h1>${filler}</body></html>`)).status, msg).toBe(
        "dead",
      );
  });

  it("treats a redirect from the ad to the job list or an error page as dead", () => {
    const u = "https://www.example.com/careers/job/learning-partner-123";
    expect(judgeLink(u, page("https://www.example.com/careers", `<h1>Open roles</h1>${filler}`)).status).toBe(
      "dead",
    );
    expect(judgeLink(u, page("https://www.example.com/", `<h1>Welcome</h1>${filler}`)).status).toBe("dead");
    expect(
      judgeLink(u, page("https://www.example.com/jobs/expired?id=123", `<h1>Hmm</h1>${filler}`)).status,
    ).toBe("dead");
  });

  it("keeps a live ad, and ignores 'expired' text hidden in scripts", () => {
    const u = "https://boards.example.com/acme/jobs/123";
    const live = `<html><head><script>var t={expired:"This job has expired"}</script></head><body><h1>Instructional Designer</h1>${filler}<p>Apply now</p></body></html>`;
    expect(judgeLink(u, page(u, live)).status).toBe("alive");
    expect(judgeLink(u, page(`${u}/`, live)).status).toBe("alive");
  });

  it("treats a short 'page not found' page as dead", () => {
    const u = "https://example.com/oferta/55";
    expect(judgeLink(u, page(u, "<h1>404 - Page not found</h1>")).status).toBe("dead");
  });
});
