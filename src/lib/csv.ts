/** CSV helpers: safe export (formula-injection protection) and header mapping for import. */

/** Cells starting with = + - @ (or control chars) are prefixed with ' so spreadsheets don't execute them. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r;]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  // BOM so Excel opens UTF-8 (Polish diacritics) correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}

const HEADER_ALIASES: Record<string, string[]> = {
  company: ["company", "firma", "company name", "nazwa firmy", "organizacja", "organization"],
  domain: ["domain", "domena", "website", "strona", "www", "company domain"],
  fullName: ["name", "full name", "imię i nazwisko", "imie i nazwisko", "osoba", "person", "contact"],
  firstName: ["first name", "imię", "imie", "firstname"],
  lastName: ["last name", "nazwisko", "lastname", "surname"],
  title: ["title", "job title", "stanowisko", "rola", "role", "position"],
  email: ["email", "e-mail", "mail", "adres e-mail", "email address"],
  department: ["department", "dział", "dzial", "skrzynka"],
  sourceUrl: ["source", "source url", "źródło", "zrodlo", "url", "link"],
  note: ["note", "notes", "notatka", "uwagi"],
};

export function mapHeaders(headers: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  const norm = (h: string) => h.trim().toLowerCase().replace(/\s+/g, " ");
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    out[field] = headers.find((h) => aliases.includes(norm(h)));
  }
  return out;
}
