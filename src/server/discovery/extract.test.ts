import { describe, expect, it } from "vitest";
import {
  brandTokens,
  containsVerbatim,
  deobfuscate,
  emailMatchesName,
  extractPage,
  findNames,
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
