import { describe, expect, it } from "vitest";
import { classifyMailbox, nameKey, normalizeEmail, registrableDomain } from "./normalize.ts";

describe("normalisation", () => {
  it("normalises emails and rejects junk", () => {
    expect(normalizeEmail(" Anna.Kowalska@Firma.PL ")).toBe("anna.kowalska@firma.pl");
    expect(normalizeEmail("mailto:hr@firma.pl")).toBe("hr@firma.pl");
    expect(normalizeEmail("not an email")).toBeNull();
    expect(normalizeEmail("a..b@firma.pl")).toBeNull();
  });
  it("computes registrable domains including Polish second-level suffixes", () => {
    expect(registrableDomain("https://www.careers.ing.pl/x")).toBe("ing.pl");
    expect(registrableDomain("sklep.firma.com.pl")).toBe("firma.com.pl");
  });
  it("builds order-independent, diacritic-folded name keys", () => {
    expect(nameKey("Łucja Żółć")).toBe(nameKey("żółć łucja"));
    expect(nameKey("dr Anna Nowak")).toBe(nameKey("Anna Nowak"));
    expect(nameKey("Anna")).toBeNull();
  });
  it("classifies mailboxes", () => {
    expect(classifyMailbox("szkolenia@firma.pl")).toBe("development");
    expect(classifyMailbox("akademia@firma.pl")).toBe("development");
    expect(classifyMailbox("hr@firma.pl")).toBe("hr");
    expect(classifyMailbox("rekrutacja@firma.pl")).toBe("recruiting");
    expect(classifyMailbox("zakupy@firma.pl")).toBe("procurement");
    expect(classifyMailbox("procurement.pl@firma.com")).toBe("procurement");
    expect(classifyMailbox("zakupy.uslug@firma.pl")).toBe("procurement");
    expect(classifyMailbox("info@firma.pl")).toBe("generic");
    expect(classifyMailbox("anna.kowalska@firma.pl")).toBe("personal");
    expect(classifyMailbox("partnerstwa.biznesowe@firma.pl")).toBe("generic");
  });
});
