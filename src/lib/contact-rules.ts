/**
 * Pure rules about contacts: data quality, staleness, send eligibility and outreach status.
 * Used by the server (to store derived fields and to gate dispatch) and by the UI (to explain).
 */

export type EmailStatus = "not_checked" | "valid" | "invalid" | "catch_all" | "unknown" | "expired";
export type EmailOrigin =
  | "published_source"
  | "provider_with_sources"
  | "provider_pattern"
  | "user_entered"
  | "imported"
  | "none";
export type EmploymentStatus =
  | "confirmed_recent"
  | "dated_evidence"
  | "unverified"
  | "possibly_left"
  | "left";
export type Eligibility =
  | "not_assessed"
  | "consent"
  | "invitation_to_offer"
  | "prior_relationship"
  | "other_documented"
  | "do_not_contact";
export type OutreachStatus =
  | "not_contacted"
  | "draft_ready"
  | "scheduled"
  | "sent"
  | "replied"
  | "follow_up_due"
  | "failed"
  | "do_not_contact";
export type Quality = "ready" | "caution" | "needs_research" | "blocked";

export type ContactFacts = {
  kind: "person" | "department_inbox" | "general_inbox";
  roleCategory:
    | "decision_maker"
    | "organizer_influencer"
    | "departmental_inbox"
    | "general_routing"
    | "uncertain";
  email: string | null;
  emailOrigin: EmailOrigin;
  emailStatus: EmailStatus;
  emailCheckedAt: Date | null;
  employmentStatus: EmploymentStatus;
  employmentCheckedAt: Date | null;
  sourcePublishedAt: string | null; // YYYY-MM-DD
  discoveredAt: Date;
  reviewStatus: "new" | "accepted" | "rejected";
  eligibilityBasis: Eligibility;
  isDemo: boolean;
  suppressed: boolean;
};

export type FreshnessPolicy = {
  emailReverifyDays: number;
  employmentRecheckDays: number;
  staleWarningDays: number;
};

export const EMAIL_STATUS_LABEL: Record<EmailStatus, string> = {
  not_checked: "Niesprawdzony",
  valid: "Poprawny wg dostawcy",
  invalid: "Nieprawidłowy",
  catch_all: "Catch-all",
  unknown: "Nieznany",
  expired: "Weryfikacja wygasła",
};

export const EMAIL_ORIGIN_LABEL: Record<EmailOrigin, string> = {
  published_source: "Opublikowany w źródle",
  provider_with_sources: "Dostawca (ze źródłami)",
  provider_pattern: "Przewidziany ze wzorca",
  user_entered: "Wpisany ręcznie",
  imported: "Zaimportowany",
  none: "Brak adresu",
};

export const ELIGIBILITY_LABEL: Record<Eligibility, string> = {
  not_assessed: "Nieocenione",
  consent: "Zgoda",
  invitation_to_offer: "Zaproszenie do składania ofert",
  prior_relationship: "Wcześniejszy kontakt / zapytanie",
  other_documented: "Inna udokumentowana podstawa",
  do_not_contact: "Nie kontaktować",
};

export const OUTREACH_LABEL: Record<OutreachStatus, string> = {
  not_contacted: "Bez kontaktu",
  draft_ready: "Szkic gotowy",
  scheduled: "Zaplanowany",
  sent: "Wysłany",
  replied: "Jest odpowiedź",
  follow_up_due: "Czas na follow-up",
  failed: "Błąd wysyłki",
  do_not_contact: "Nie kontaktować",
};

export const QUALITY_LABEL: Record<Quality, string> = {
  ready: "Gotowy",
  caution: "Z ostrożnością",
  needs_research: "Wymaga uzupełnienia",
  blocked: "Zablokowany",
};

function ageDays(d: Date | string | null, now: Date): number | null {
  if (!d) return null;
  const t = typeof d === "string" ? Date.parse(d) : d.getTime();
  return Number.isNaN(t) ? null : Math.floor((now.getTime() - t) / 86_400_000);
}

export function isFallback(c: Pick<ContactFacts, "kind" | "roleCategory">): boolean {
  return c.kind === "general_inbox" || c.roleCategory === "general_routing";
}

export type Staleness = { email: boolean; employment: boolean; reasons: string[] };

export function staleness(c: ContactFacts, policy: FreshnessPolicy, now = new Date()): Staleness {
  const reasons: string[] = [];
  let email = false;
  let employment = false;
  if (c.email) {
    const age = ageDays(c.emailCheckedAt, now);
    if (c.emailStatus === "expired") {
      email = true;
      reasons.push("Weryfikacja adresu wygasła");
    } else if (c.emailCheckedAt && age !== null && age > policy.emailReverifyDays) {
      email = true;
      reasons.push(`Adres weryfikowany ${age} dni temu`);
    }
  }
  if (c.kind === "person") {
    const checked = ageDays(c.employmentCheckedAt, now);
    const published = ageDays(c.sourcePublishedAt, now);
    if (c.employmentStatus === "possibly_left") {
      employment = true;
      reasons.push("Możliwa zmiana pracodawcy");
    } else if (published !== null && published > policy.staleWarningDays) {
      employment = true;
      reasons.push(`Źródło z ${c.sourcePublishedAt} — może być nieaktualne`);
    } else if (checked === null || checked > policy.employmentRecheckDays) {
      const since = ageDays(c.discoveredAt, now) ?? 0;
      if (checked !== null || since > policy.employmentRecheckDays) {
        employment = true;
        reasons.push("Zatrudnienie dawno nie sprawdzane");
      }
    }
  }
  return { email, employment, reasons };
}

export type Assessment = { quality: Quality; reasons: string[] };

/** Data quality grade. "ready" never applies to a guessed (pattern) address that is not valid. */
export function assessContact(c: ContactFacts, policy: FreshnessPolicy, now = new Date()): Assessment {
  const reasons: string[] = [];
  if (c.suppressed) return { quality: "blocked", reasons: ["Na liście wykluczeń"] };
  if (c.eligibilityBasis === "do_not_contact")
    return { quality: "blocked", reasons: ["Oznaczony: nie kontaktować"] };
  if (c.reviewStatus === "rejected") return { quality: "blocked", reasons: ["Odrzucony w przeglądzie"] };
  if (c.employmentStatus === "left")
    return { quality: "blocked", reasons: ["Osoba nie pracuje już w firmie"] };
  if (!c.email) return { quality: "needs_research", reasons: ["Brak adresu e-mail"] };
  if (c.emailStatus === "invalid") return { quality: "blocked", reasons: ["Adres nieprawidłowy"] };
  if (c.emailOrigin === "provider_pattern" && c.emailStatus !== "valid") {
    return { quality: "needs_research", reasons: ["Adres przewidziany ze wzorca — wymaga weryfikacji"] };
  }
  const st = staleness(c, policy, now);
  reasons.push(...st.reasons);
  if (isFallback(c)) reasons.push("Kontakt ogólny (zapasowy)");
  if (c.roleCategory === "uncertain") reasons.push("Rola niepewna");
  if (c.emailStatus === "catch_all") reasons.push("Domena catch-all");
  if (c.emailStatus === "unknown") reasons.push("Wynik weryfikacji nieznany");
  if (c.emailStatus === "not_checked") reasons.push("Adres niezweryfikowany");
  if (c.emailOrigin === "provider_pattern") reasons.push("Adres przewidziany ze wzorca (zweryfikowany)");
  const ready =
    c.emailStatus === "valid" &&
    !st.email &&
    !st.employment &&
    !isFallback(c) &&
    c.roleCategory !== "uncertain" &&
    c.emailOrigin !== "provider_pattern";
  return { quality: ready ? "ready" : "caution", reasons };
}

export type SendCheck = { blockers: string[]; warnings: string[] };

/**
 * Hard blockers stop dispatch; warnings require explicit acknowledgement in the approval snapshot.
 * Called again immediately before sending.
 */
export function checkSendable(
  c: ContactFacts,
  policy: FreshnessPolicy,
  opts: { requireEligibilityBasis: boolean; recentCompanyContact?: { at: Date; who: string } | null },
  now = new Date(),
): SendCheck {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (c.isDemo) blockers.push("Rekord demonstracyjny — wysyłka wyłączona");
  if (!c.email) blockers.push("Brak adresu e-mail");
  if (c.suppressed) blockers.push("Adres lub firma na liście wykluczeń");
  if (c.eligibilityBasis === "do_not_contact") blockers.push("Kontakt oznaczony: nie kontaktować");
  if (opts.requireEligibilityBasis && c.eligibilityBasis === "not_assessed") {
    blockers.push("Brak udokumentowanej podstawy do wysyłki (Uprawnienie do kontaktu)");
  }
  if (c.reviewStatus === "rejected") blockers.push("Kontakt odrzucony w przeglądzie");
  if (c.employmentStatus === "left") blockers.push("Osoba nie pracuje już w firmie");
  if (c.emailStatus === "invalid") blockers.push("Adres nieprawidłowy");
  if (c.email && c.emailOrigin === "provider_pattern" && c.emailStatus !== "valid") {
    blockers.push("Adres przewidziany ze wzorca i niezweryfikowany");
  }
  const st = staleness(c, policy, now);
  if (st.email || st.employment) warnings.push(...st.reasons);
  if (c.emailStatus === "not_checked") warnings.push("Adres nie był weryfikowany");
  if (c.emailStatus === "catch_all")
    warnings.push("Domena przyjmuje każdy adres (catch-all) — doręczenie niepewne");
  if (c.emailStatus === "unknown") warnings.push("Weryfikacja nie dała jednoznacznego wyniku");
  if (isFallback(c)) warnings.push("To ogólny adres firmy, nie osoba odpowiedzialna za rozwój");
  if (c.roleCategory === "uncertain") warnings.push("Trafność roli niepewna");
  if (opts.recentCompanyContact) {
    warnings.push(`W tej firmie trwa już rozmowa: ${opts.recentCompanyContact.who}`);
  }
  return { blockers, warnings };
}

export type MessageFacts = {
  status: "draft" | "approved" | "scheduled" | "sending" | "sent" | "failed" | "uncertain" | "cancelled";
  sentAt: Date | null;
};

export function deriveOutreachStatus(input: {
  doNotContact: boolean;
  messages: MessageFacts[];
  lastHumanReplyAt: Date | null;
  followUpAt: Date | null;
  now?: Date;
}): OutreachStatus {
  const now = input.now ?? new Date();
  if (input.doNotContact) return "do_not_contact";
  const sent = input.messages.filter((m) => m.status === "sent" && m.sentAt);
  const lastSent = sent.reduce<Date | null>((acc, m) => (!acc || m.sentAt! > acc ? m.sentAt : acc), null);
  if (input.lastHumanReplyAt && lastSent && input.lastHumanReplyAt >= lastSent) return "replied";
  if (input.messages.some((m) => m.status === "scheduled" || m.status === "sending")) return "scheduled";
  if (input.messages.some((m) => m.status === "failed" || m.status === "uncertain")) {
    const lastProblem = input.messages.find((m) => m.status === "failed" || m.status === "uncertain");
    if (lastProblem && !lastSent) return "failed";
  }
  if (lastSent) {
    if (input.followUpAt && input.followUpAt <= now) return "follow_up_due";
    return "sent";
  }
  if (input.lastHumanReplyAt) return "replied";
  if (input.messages.some((m) => m.status === "draft" || m.status === "approved")) return "draft_ready";
  return "not_contacted";
}
