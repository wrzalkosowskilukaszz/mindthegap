import { describe, expect, it } from "vitest";
import { fileSize, plural, usd } from "./plural.ts";
import { formatWarsaw } from "./time.ts";

describe("Polish formatting", () => {
  it("uses the right plural form", () => {
    const f = (n: number) => plural(n, "sprawa", "sprawy", "spraw");
    expect([1, 2, 4, 5, 12, 22, 25, 104].map(f)).toEqual([
      "sprawa",
      "sprawy",
      "sprawy",
      "spraw",
      "spraw",
      "sprawy",
      "spraw",
      "sprawy",
    ]);
  });

  it("formats money, file sizes and SQL timestamps", () => {
    expect(usd(0).replace(/\s/g, " ")).toBe("0,00 USD");
    expect(fileSize(2048)).toBe("2 KB");
    expect(formatWarsaw("2026-10-15 17:41:53.218+00", "d.LL.yyyy HH:mm")).toBe("15.10.2026 19:41");
    expect(formatWarsaw("not a date")).toBe("—");
  });
});
