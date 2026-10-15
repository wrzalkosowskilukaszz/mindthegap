import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { cvDocx, parseCv } from "./docx.ts";

const text = `# Anna Nowak
anna@example.com · [LinkedIn](https://linkedin.com/in/x)

## Profil
Trenerka & facylitatorka <z pasją>.

## Doświadczenie
**L&D Manager** — Firma, 2020–2024
- Prowadziłam *warsztaty* dla 30 zespołów

## Do sprawdzenia
- To nie trafi do pliku.`;

describe("tailored CV as Word", () => {
  it("reads the simple Markdown and drops the notes", () => {
    const p = parseCv(text);
    expect(p.map((x) => x.kind)).toEqual(["title", "text", "heading", "text", "heading", "text", "bullet"]);
    expect(p[1]!.runs.map((r) => r.text).join("")).toBe(
      "anna@example.com · LinkedIn (https://linkedin.com/in/x)",
    );
    expect(p[5]!.runs[0]).toEqual({ text: "L&D Manager", bold: true });
    expect(p[6]!.runs.map((r) => r.text).join("")).toBe("Prowadziłam warsztaty dla 30 zespołów");
  });

  it("builds a valid Word package with escaped text", async () => {
    const zip = await JSZip.loadAsync(await cvDocx(text, "CV - Firma - Rola"));
    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining(["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml"]),
    );
    const doc = await zip.file("word/document.xml")!.async("string");
    expect(doc).toContain("Trenerka &amp; facylitatorka &lt;z pasją&gt;.");
    expect(doc).not.toContain("To nie trafi");
  });
});
