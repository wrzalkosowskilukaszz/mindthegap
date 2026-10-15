/**
 * Turns a tailored CV (plain text with simple Markdown: "# name", "## section", "- bullet", "**bold**")
 * into a Word file. Minimal Office Open XML, built with JSZip; no template, no external service.
 */
import JSZip from "jszip";
import { splitTailored } from "@/lib/jobs/tailor";

type Run = { text: string; bold: boolean };
export type Para = { kind: "title" | "heading" | "bullet" | "text"; runs: Run[] };

function inline(s: string): Run[] {
  const plain = s
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t: string, u: string) =>
      t === u ? u : `${t} (${u})`,
    )
    .replace(/`([^`]+)`/g, "$1");
  const runs: Run[] = [];
  let last = 0;
  for (const m of plain.matchAll(/\*\*(.+?)\*\*|__(.+?)__/g)) {
    if (m.index > last) runs.push({ text: plain.slice(last, m.index), bold: false });
    runs.push({ text: m[1] ?? m[2] ?? "", bold: true });
    last = m.index + m[0].length;
  }
  if (last < plain.length) runs.push({ text: plain.slice(last), bold: false });
  // Single *italic* markers are dropped; Word gets the words.
  return runs
    .map((r) => ({ ...r, text: r.text.replace(/(^|[\s(])\*(\S[^*]*?)\*(?=$|[\s.,;:)])/g, "$1$2") }))
    .filter((r) => r.text);
}

export function parseCv(text: string): Para[] {
  const out: Para[] = [];
  for (const raw of splitTailored(text).cv.split("\n")) {
    const line = raw.trim();
    if (!line || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) continue;
    const title = /^#\s+(.+)$/.exec(line);
    const heading = /^#{2,6}\s+(.+)$/.exec(line);
    const bullet = /^[-*•–]\s+(.+)$/.exec(line);
    // A line that is only **CAPITALS** is a section heading too.
    const bold = /^\*\*([^*]+)\*\*:?$/.exec(line);
    if (title) out.push({ kind: "title", runs: inline(title[1]!) });
    else if (heading) out.push({ kind: "heading", runs: inline(heading[1]!) });
    else if (bullet) out.push({ kind: "bullet", runs: inline(bullet[1]!) });
    else if (bold && line.length < 60 && bold[1] === bold[1]!.toUpperCase())
      out.push({ kind: "heading", runs: inline(bold[1]!) });
    else out.push({ kind: "text", runs: inline(line) });
  }
  return out;
}

const esc = (s: string) =>
  s
    // biome-ignore lint/suspicious/noControlCharactersInRegex: characters XML does not allow
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function runXml(r: Run, size?: number): string {
  const props = `${r.bold ? "<w:b/>" : ""}${size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : ""}`;
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(r.text)}</w:t></w:r>`;
}

function paraXml(p: Para, prev?: Para["kind"]): string {
  if (p.kind === "title")
    return `<w:p><w:pPr><w:spacing w:after="60"/></w:pPr>${p.runs.map((r) => runXml({ ...r, bold: true }, 36)).join("")}</w:p>`;
  if (p.kind === "heading")
    return `<w:p><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="2" w:color="B7B7B7"/></w:pBdr><w:spacing w:before="240" w:after="80"/></w:pPr>${p.runs.map((r) => runXml({ ...r, bold: true }, 24)).join("")}</w:p>`;
  if (p.kind === "bullet")
    return `<w:p><w:pPr><w:ind w:left="360" w:hanging="240"/><w:spacing w:after="40"/></w:pPr><w:r><w:t xml:space="preserve">•  </w:t></w:r>${p.runs.map((r) => runXml(r)).join("")}</w:p>`;
  // The next job after a list of bullets gets a little air.
  const air = prev === "bullet" ? `<w:pPr><w:spacing w:before="140"/></w:pPr>` : "";
  return `<w:p>${air}${p.runs.map((r) => runXml(r)).join("")}</w:p>`;
}

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export async function cvDocx(text: string, title: string): Promise<Uint8Array> {
  const paras = parseCv(text);
  const body = paras.map((p, i) => paraXml(p, paras[i - 1]?.kind)).join("");
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
  );
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(title)}</dc:title></cp:coreProperties>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:color w:val="222222"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="pl-PL"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1021" w:right="1077" w:bottom="1021" w:left="1077" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
