import { describe, expect, it } from "vitest";
import {
  brandTokens,
  cleanTitle,
  containsVerbatim,
  deobfuscate,
  emailMatchesName,
  extractPage,
  findNames,
  foreignEntity,
  invitationFor,
  procurementScope,
  scoreLink,
} from "./extract.ts";

describe("page extraction", () => {
  const html = `<html><head><meta property="article:published_time" content="2025-03-01T10:00:00Z"></head><body>
    <nav><a href="/kontakt">Kontakt</a><a href="/o-nas/zarzad">Zarząd</a><a href="/esg/raport-zrownowazonego-rozwoju-2024">ESG</a><a href="https://other.com/x">x</a></nav>
    <ul><li><h4>Anna Kowalska</h4><p>Dyrektor HR</p><p><a href="mailto:anna.kowalska@firma.pl">napisz</a></p></li>
        <li><h4>Jan Nowak</h4><p>Dyrektor Finansowy</p></li></ul>
    <p>Oferty szkoleniowe prosimy kierować na adres: szkolenia [at] firma [dot] pl</p>
    <footer><p>Biuro: info@firma.pl, przykład: jan@gmail.com, grupa: hr@firmagroup.com</p></footer>
  </body></html>`;
  const ex = extractPage(html, "https://firma.pl/kontakt", ["firma.pl"], ["Firma"]);

  it("finds named people next to relevant titles only, with their own email", () => {
    expect(ex.people).toHaveLength(1);
    expect(ex.people[0]).toMatchObject({
      fullName: "Anna Kowalska",
      title: "Dyrektor HR",
      email: "anna.kowalska@firma.pl",
    });
  });
  it("de-obfuscates addresses, keeps company domains, ignores free-mail", () => {
    const emails = ex.emails.map((e) => e.email).sort();
    expect(emails).toContain("szkolenia@firma.pl");
    expect(emails).toContain("info@firma.pl");
    expect(emails).toContain("hr@firmagroup.com"); // same brand, different domain
    expect(emails).not.toContain("jan@gmail.com");
  });
  it("detects explicit invitations to send offers", () => {
    expect(ex.emails.find((e) => e.email === "szkolenia@firma.pl")?.invitation).toBe(true);
    expect(ex.emails.find((e) => e.email === "info@firma.pl")?.invitation).toBe(false);
  });
  it("reads the publication date and same-site links only", () => {
    expect(ex.publishedAt).toBe("2025-03-01");
    expect(ex.links.every((l) => l.url.startsWith("https://firma.pl/"))).toBe(true);
  });
  it("every stored value appears verbatim in its quote block", () => {
    for (const p of ex.people) {
      expect(containsVerbatim(p.block, p.fullName)).toBe(true);
      expect(containsVerbatim(p.block, p.title)).toBe(true);
    }
  });
});

describe("helpers", () => {
  it("names need a known first name", () => {
    expect(findNames("Spotkanie: Anna Kowalska oraz Grupa Orlen i Dyrektor Personalny")).toEqual([
      "Anna Kowalska",
    ]);
  });
  it("matches email local parts to names", () => {
    expect(emailMatchesName("a.kowalska@x.pl", "Anna Kowalska")).toBe(true);
    expect(emailMatchesName("anna.kowalska@x.pl", "Anna Kowalska")).toBe(true);
    expect(emailMatchesName("jan.nowak@x.pl", "Anna Kowalska")).toBe(false);
  });
  it("de-obfuscates common patterns", () => {
    expect(deobfuscate("hr (at) firma (dot) pl")).toBe("hr@firma.pl");
  });
  it("brand tokens skip generic words", () => {
    expect(brandTokens(["KRUK S.A.", "Grupa Polska"])).toEqual(["kruk"]);
  });
  it("scores section pages above articles and sustainability pages", () => {
    expect(scoreLink("https://x.pl/kontakt", "")).toBeGreaterThan(5);
    expect(scoreLink("https://x.pl/akademia-lidera", "")).toBeGreaterThan(8);
    expect(scoreLink("https://x.pl/dla-dostawcow", "")).toBeGreaterThan(7);
    expect(scoreLink("https://x.pl/zrownowazony-rozwoj", "")).toBe(0);
    expect(scoreLink("https://x.pl/o-czym-pamietac-przy-zakupie-ac", "")).toBe(0);
    expect(scoreLink("https://x.pl/esg/raport", "")).toBe(0);
  });
});

describe("quality guards", () => {
  const contactPage = (body: string) => `<html><body>${body}</body></html>`;

  it("ties an invitation to send offers only to the address it points at", () => {
    const block =
      "Dla dostawców usług e-mail: zakupy.uslug@firma.pl Polityka zakupowa Dla mediów e-mail: media@firma.pl Dla inwestorów e-mail: inwestor@firma.pl";
    expect(invitationFor("zakupy.uslug@firma.pl", block)).toBe(true);
    expect(invitationFor("media@firma.pl", block)).toBe(false);
    expect(invitationFor("inwestor@firma.pl", block)).toBe(false);
    // A goods-delivery address under a "for suppliers" heading is not an invitation to send offers.
    expect(
      invitationFor(
        "logistyka@firma.pl",
        "Dla dostawców\nAdres dostaw towarów:\nul. Fabryczna 1, 00-001 Miasto\nlogistyka@firma.pl",
      ),
    ).toBe(false);
    const ex = extractPage(contactPage(`<p>${block}</p>`), "https://firma.pl/kontakt", ["firma.pl"]);
    const inv = Object.fromEntries(ex.emails.map((e) => [e.email, e.invitation]));
    expect(inv).toEqual({
      "zakupy.uslug@firma.pl": true,
      "media@firma.pl": false,
      "inwestor@firma.pl": false,
    });
  });

  it("tells purchasing of production materials from purchasing of services", () => {
    expect(procurementScope("Dla dostawców. Zakupy komponentów do produkcji mebli: zakupy@firma.pl")).toBe(
      "direct",
    );
    expect(procurementScope("Zakupy usług nieprodukcyjnych: zakupy@firma.pl")).toBe("services");
    expect(procurementScope("Dział Zakupów: zakupy@firma.pl")).toBe("unknown");
  });

  it("skips addresses of subsidiaries abroad", () => {
    const html = contactPage(`
      <div>Firma Adria d.o.o. Kontakt: E: hr.adria@firma.pl Adres Kneza Branimira 71A, 10000 Zagrzeb Chorwacja</div>
      <div>Firma Polska Sp. z o.o., ul. Prosta 1, 00-001 Warszawa. HR: hr@firma.pl</div>`);
    const ex = extractPage(html, "https://firma.pl/kontakt", ["firma.pl"]);
    expect(ex.emails.map((e) => e.email)).toEqual(["hr@firma.pl"]);
    expect(foreignEntity("Biuro w Polsce, oddział w Niemczech")).toBe(false);
  });

  it("does not take another country's domain of the same brand", () => {
    const html = contactPage(
      `<p>Business: business.development@firma.it, Szkolenia: szkolenia@firma.com</p>`,
    );
    const ex = extractPage(html, "https://firma.pl/kontakt", ["firma.pl"]);
    expect(ex.emails.map((e) => e.email)).toEqual(["szkolenia@firma.com"]);
  });

  it("cleans list dashes from titles", () => {
    expect(cleanTitle("- Junior HR Business Partner")).toBe("Junior HR Business Partner");
    expect(cleanTitle("• Dyrektor Personalna,")).toBe("Dyrektor Personalna");
  });
});
