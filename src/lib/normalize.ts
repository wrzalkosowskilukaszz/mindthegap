/** Pure normalisation helpers shared by import, discovery and dedupe. */
import { FIRST_NAMES } from "./first-names.ts";

const DIACRITICS: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
  ä: "a",
  ö: "o",
  ü: "u",
  ß: "ss",
  é: "e",
  è: "e",
  á: "a",
  í: "i",
  ú: "u",
  č: "c",
  š: "s",
  ž: "z",
};

export function foldDiacritics(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ąćęłńóśźżäöüßéèáíúčšž]/g, (c) => DIACRITICS[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

/** Lower-case, trimmed email; returns null for anything that is not a plausible address. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const e = raw
    .trim()
    .replace(/^mailto:/i, "")
    .replace(/[)>.,;:]+$/, "")
    .toLowerCase();
  if (e.length > 254) return null;
  if (!/^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,24}$/.test(e)) return null;
  if (e.includes("..")) return null;
  return e;
}

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1);
}

const MULTI_PART_SUFFIXES = new Set([
  "com.pl",
  "net.pl",
  "org.pl",
  "co.uk",
  "com.au",
  "co.jp",
  "com.br",
  "waw.pl",
  "gov.pl",
  "edu.pl",
]);

/** Registrable domain ("www.careers.ing.pl" -> "ing.pl"), simple public-suffix handling. */
export function registrableDomain(hostOrUrl: string): string | null {
  let host = hostOrUrl.trim().toLowerCase();
  try {
    if (host.includes("://")) host = new URL(host).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\d?\./, "").replace(/\.$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,24}$/.test(host)) return null;
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_SUFFIXES.has(lastTwo)) return parts.slice(-3).join(".");
  return lastTwo;
}

/** Stable key for a person's name: folded, sorted tokens ("Kowalska Anna" == "Anna Kowalska"). */
export function nameKey(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const tokens = foldDiacritics(fullName)
    .replace(/\b(dr|mgr|inz|prof|hab|phd|mba)\b\.?/g, " ")
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1);
  if (tokens.length < 2) return null;
  return tokens.sort().join(" ");
}

export function slugify(s: string): string {
  return foldDiacritics(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Generic/role mailbox local parts (fallback contacts). */
const GENERIC_LOCAL =
  /^(info|biuro|office|kontakt|contact|hello|hi|mail|sekretariat|recepcja|reception|admin|support|pomoc|help|sales|sprzedaz|marketing|newsletter|webmaster|abuse|postmaster|zarzad|board|serwis|service|reklamacje|zamowienia|orders|sklep|shop|eksport|export)$/;
/**
 * Mailboxes with a different job (press, investors, privacy, ethics, sales/business development).
 * They are kept only as general routing and are never treated as procurement or development.
 */
export const NON_BUYER_LOCAL =
  /^(media|press|prasa|pr|newsroom|investors?|inwestor\w*|ir|relacje[._-]?inwestorskie|rodo|gdpr|iod|dpo|privacy|prywatnosc|daneosobowe|ochronadanych|dane[._-]?osobowe|sygnalista|whistleblow\w*|etyka|ethics|compliance|noreply|no-reply|donotreply|business[._-]?development|bizdev|bd|rozwoj[._-]?biznesu|partnerstwa?\w*|partners?|partnership\w*|sales\w*|sprzedaz\w*|marketing\w*)$/;
const RECRUITING_LOCAL = /(rekrutacj|recruit|career|kariera|jobs?$|praca|cv$|hiring|talent\.?acq|ta$)/;
const PROCUREMENT_LOCAL =
  /^(zakupy|zakup|procurement|purchasing|purchase|zaopatrzenie|przetargi|tenders?|sourcing|dostawcy|suppliers?|vendors?|indirect)([._-]?(pl|polska|poland|uslug|services|team))?$/;
/** Unambiguous people-development words. */
const DEVELOPMENT_LOCAL = /(szkolen|training|akademi|academy|learning|l&d|lnd|edukacj|culture|kultur)/;
/** "rozwój"/"development" alone is often R&D or business development: only with a people word. */
const PEOPLE_DEVELOPMENT_LOCAL =
  /(rozwoj|development)[._-]?(pracownik\w*|ludzi|kadr\w*|talent\w*|people|kompetencji|osobist\w*|liderow)|(people|talent|hr|personal\w*|leadership|kadr\w*|pracownik\w*)[._-]?(rozwoj|development)/;
const HR_LOCAL =
  /^(hr|kadry|personal|personalny|people|peopleteam|hrteam|zasoby[._-]?ludzkie)$|^hr[._-]|[._-]hr$|hr$/;

export type MailboxType = "personal" | "development" | "hr" | "procurement" | "recruiting" | "generic";

function looksPersonal(local: string): boolean {
  const parts = foldDiacritics(local).split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    // first.last / last.first / f.last
    if (FIRST_NAMES.has(parts[0]!) || FIRST_NAMES.has(parts[parts.length - 1]!)) return true;
    if (parts[0]!.length === 1 && parts[1]!.length > 2) return true;
  }
  return false;
}

export function classifyMailbox(email: string): MailboxType {
  const local = email.slice(0, email.indexOf("@")).toLowerCase();
  if (RECRUITING_LOCAL.test(local)) return "recruiting";
  if (NON_BUYER_LOCAL.test(local) || GENERIC_LOCAL.test(local)) return "generic";
  if (PROCUREMENT_LOCAL.test(local)) return "procurement";
  if (DEVELOPMENT_LOCAL.test(local) || PEOPLE_DEVELOPMENT_LOCAL.test(local)) return "development";
  if (HR_LOCAL.test(local)) return "hr";
  if (looksPersonal(local)) return "personal";
  return "generic";
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** "polpharma.pl" and "polpharma.com" share the label "polpharma" (same organisation, different TLD). */
export function domainLabel(registrable: string): string {
  return registrable.split(".")[0] ?? registrable;
}
