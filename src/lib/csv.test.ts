import { describe, expect, it } from "vitest";
import { csvCell, mapHeaders, toCsv } from "./csv.ts";

describe("csv", () => {
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+48 123")).toBe("'+48 123");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });
  it("quotes separators and doubles quotes", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(toCsv(["a"], [["ż"]]).startsWith("﻿")).toBe(true);
  });
  it("maps Polish and English headers", () => {
    expect(mapHeaders(["Firma", "Imię i nazwisko", "E-mail", "Stanowisko"])).toMatchObject({
      company: "Firma",
      fullName: "Imię i nazwisko",
      email: "E-mail",
      title: "Stanowisko",
    });
  });
});
