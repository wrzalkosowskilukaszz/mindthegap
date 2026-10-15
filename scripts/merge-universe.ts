/**
 * Merge research/companies/staging/*.jsonl into research/companies/universe.jsonl:
 * validate every record, dedupe across slices (domain, slug, folded brand), and write a report.
 * Usage: node --import tsx scripts/merge-universe.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { foldDiacritics } from "../src/lib/normalize.ts";
import { CompanyRecord } from "../src/lib/research/company-record.ts";

const dir = path.resolve(import.meta.dirname, "../research/companies");
const staging = path.join(dir, "staging");
const files = readdirSync(staging)
  .filter((f) => f.endsWith(".jsonl"))
  .sort();

type Rec = CompanyRecord & { _file: string };
const accepted: Rec[] = [];
const invalid: { file: string; line: number; issues: string }[] = [];
const dupes: { kept: string; dropped: string; why: string }[] = [];

const byDomain = new Map<string, Rec>();
const bySlug = new Map<string, Rec>();
const byBrand = new Map<string, Rec>();

function brandKey(r: CompanyRecord): string {
  return foldDiacritics(r.brand ?? r.name)
    .replace(
      /\b(s\.?a\.?|sp\.? z o\.?o\.?|spolka akcyjna|polska|poland|group|grupa|ltd|gmbh|inc|plc|n\.v\.|ag|se)\b/g,
      "",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function score(r: CompanyRecord): number {
  return (
    (r.employees_poland ? 4 : 0) + (r.employees_global ? 2 : 0) + r.sources.length + r.priority_signals.length
  );
}

for (const f of files) {
  const lines = readFileSync(path.join(staging, f), "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      invalid.push({ file: f, line: i + 1, issues: "not JSON" });
      return;
    }
    const parsed = CompanyRecord.safeParse(json);
    if (!parsed.success) {
      invalid.push({
        file: f,
        line: i + 1,
        issues: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "),
      });
      return;
    }
    const r: Rec = { ...parsed.data, domain: parsed.data.domain.toLowerCase(), _file: f };
    const clash = byDomain.get(r.domain) ?? bySlug.get(r.id);
    // Same brand in two slices is only a duplicate when it is not a deliberately separate entity.
    const brandClash = byBrand.get(brandKey(r));
    const other =
      clash ?? (brandClash && !r.relationship_note && !brandClash.relationship_note ? brandClash : undefined);
    if (other) {
      const keep = score(r) > score(other) ? r : other;
      const drop = keep === r ? other : r;
      dupes.push({
        kept: `${keep.id} (${keep._file})`,
        dropped: `${drop.id} (${drop._file})`,
        why: clash ? "same domain/slug" : "same brand",
      });
      if (keep === r) {
        const idx = accepted.indexOf(other);
        accepted[idx] = r;
        byDomain.set(r.domain, r);
        bySlug.set(r.id, r);
        byBrand.set(brandKey(r), r);
      }
      return;
    }
    accepted.push(r);
    byDomain.set(r.domain, r);
    bySlug.set(r.id, r);
    byBrand.set(brandKey(r), r);
  });
}

accepted.sort((a, b) => a.sector.localeCompare(b.sector) || a.name.localeCompare(b.name, "pl"));
writeFileSync(
  path.join(dir, "universe.jsonl"),
  `${accepted.map(({ _file, ...r }) => JSON.stringify(r)).join("\n")}\n`,
);

const bySector = new Map<string, number>();
let pl = 0;
let gl = 0;
let none = 0;
let signals = 0;
for (const r of accepted) {
  bySector.set(r.sector, (bySector.get(r.sector) ?? 0) + 1);
  if (r.employees_poland) pl++;
  else if (r.employees_global) gl++;
  else none++;
  if (r.priority_signals.length) signals++;
}
const report = [
  "# Company universe — merge report",
  "",
  `Generated: ${new Date().toISOString().slice(0, 10)} by \`scripts/merge-universe.ts\` from ${files.map((f) => `\`staging/${f}\``).join(", ")}.`,
  "",
  `- Records accepted: **${accepted.length}**`,
  `- With Polish headcount (sourced): ${pl}; global headcount only: ${gl}; no sourced headcount: ${none}`,
  `- With at least one priority signal (L&D evidence): ${signals}`,
  `- Invalid records rejected by the schema: ${invalid.length}`,
  `- Cross-slice duplicates removed: ${dupes.length}`,
  "",
  "## By sector",
  "",
  "| Sector | Companies |",
  "|---|---|",
  ...[...bySector.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `| ${s} | ${n} |`),
  "",
  "## Duplicates removed",
  "",
  ...(dupes.length ? dupes.map((d) => `- kept ${d.kept}, dropped ${d.dropped} (${d.why})`) : ["None."]),
  "",
  "## Invalid records",
  "",
  ...(invalid.length ? invalid.map((x) => `- ${x.file}:${x.line} — ${x.issues}`) : ["None."]),
  "",
];
writeFileSync(path.join(dir, "MERGE-REPORT.md"), report.join("\n"));
console.log(`accepted=${accepted.length} invalid=${invalid.length} dupes=${dupes.length}`);
