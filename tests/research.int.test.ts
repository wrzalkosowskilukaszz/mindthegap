/**
 * Company research end to end with a fake website: department spread, procurement mailboxes, and the
 * budgeted site search used when the site's own menus lead to nobody relevant.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const searchCalls: { query: string; includeDomains?: string[] }[] = [];
let searchHits: string[] = [];
vi.mock("../src/server/providers/index.ts", async (orig) => {
  const real = await orig<typeof import("../src/server/providers/index.ts")>();
  return {
    ...real,
    webSearch: () => ({
      name: "tavily",
      creditsPerQuery: 1,
      search: async (query: string, opts?: { includeDomains?: string[] }) => {
        searchCalls.push({ query, includeDomains: opts?.includeDomains });
        return searchHits.map((url) => ({ url, title: "", snippet: "", age: null }));
      },
    }),
  };
});

const { closeDb, db } = await import("../src/server/db/client.ts");
const { companies, contacts, providerUsage } = await import("../src/server/db/schema.ts");
const { researchCompany } = await import("../src/server/discovery/research-company.ts");
const { hasDb, resetDb } = await import("./db.ts");
type Fetcher = Parameters<typeof researchCompany>[1]["fetcher"];

const page = (body: string) =>
  `<!doctype html><html><head><title>Firma</title></head><body>${body}</body></html>`;

function fakeSite(pages: Record<string, string>) {
  const fetched: string[] = [];
  const fetcher = {
    async get(url: string) {
      fetched.push(url);
      const body = pages[url];
      return body
        ? { ok: true as const, url, status: 200, body, contentType: "text/html" }
        : { ok: false as const, url, reason: "http_error" as const, status: 404 };
    },
    async sitemapsFromRobots() {
      return [];
    },
  } as unknown as Fetcher;
  return { fetcher, fetched };
}

describe.skipIf(!hasDb)("company research", () => {
  let companyId: string;
  beforeEach(async () => {
    await resetDb();
    searchCalls.length = 0;
    searchHits = [];
    const [c] = await db()
      .insert(companies)
      .values({ slug: "firma", name: "Firma S.A.", domain: "firma.pl", website: "https://firma.pl/" })
      .returning();
    companyId = c!.id;
  });
  afterAll(closeDb);

  const run = (fetcher: Fetcher) =>
    researchCompany(companyId, { fetcher, deadline: Date.now() + 60_000, maxPages: 10, maxContacts: 4 });

  it("keeps HR, procurement and business leaders, one department at a time", async () => {
    const { fetcher } = fakeSite({
      "https://firma.pl/": page(`<a href="/zarzad">Zarząd</a> <a href="/dla-dostawcow">Dla dostawców</a>`),
      "https://firma.pl/zarzad": page(`
        <div class="card"><h3>Anna Kowalska</h3><p>Dyrektor Personalna</p></div>
        <div class="card"><h3>Piotr Nowak</h3><p>Dyrektor Operacyjny</p></div>
        <div class="card"><h3>Maria Wiśniewska</h3><p>HR Business Partner</p></div>
        <div class="card"><h3>Tomasz Zieliński</h3><p>HR Manager</p></div>`),
      "https://firma.pl/dla-dostawcow": page(
        `<p>Dział Zakupów: oferty prosimy kierować na adres <a href="mailto:zakupy@firma.pl">zakupy@firma.pl</a>.</p>`,
      ),
    });
    const r = await run(fetcher);
    const rows = await db().select().from(contacts).where(eq(contacts.companyId, companyId));
    const fns = rows.map((c) => c.roleFunction).sort();
    // Cap of 4: HR, business leadership and procurement are all represented before a second HR person.
    expect(rows).toHaveLength(4);
    expect(fns).toEqual(["business_leadership", "hr", "hr", "procurement"]);
    const inbox = rows.find((c) => c.emailNormalized === "zakupy@firma.pl");
    expect(inbox).toMatchObject({ kind: "department_inbox", roleFunction: "procurement" });
    expect(r.searched).toBeUndefined(); // relevant contacts found: no paid search
    expect(searchCalls).toHaveLength(0);
  });

  it("searches the company's own site (budgeted) when its menus lead to nobody relevant", async () => {
    searchHits = ["https://firma.pl/kariera/akademia-lidera", "https://inna-firma.pl/hr"];
    const { fetcher, fetched } = fakeSite({
      "https://firma.pl/": page(`<a href="/produkty">Produkty</a>`),
      "https://firma.pl/kariera/akademia-lidera": page(
        `<div class="card"><h3>Ewa Lewandowska</h3><p>Kierownik Akademii Lidera</p><p>ewa.lewandowska@firma.pl</p></div>`,
      ),
    });
    const r = await run(fetcher);
    expect(searchCalls).toEqual([expect.objectContaining({ includeDomains: ["firma.pl"] })]);
    expect(fetched).toContain("https://firma.pl/kariera/akademia-lidera");
    expect(fetched).not.toContain("https://inna-firma.pl/hr"); // other domains are never crawled
    expect(r.searched).toBe(1);
    const [c] = await db().select().from(contacts).where(eq(contacts.companyId, companyId));
    expect(c).toMatchObject({
      fullName: "Ewa Lewandowska",
      roleFunction: "learning",
      roleCategory: "decision_maker",
    });
    const usage = await db().select().from(providerUsage);
    expect(usage).toEqual([
      expect.objectContaining({ provider: "tavily", operation: "search", status: "committed", credits: 1 }),
    ]);
  });
});
