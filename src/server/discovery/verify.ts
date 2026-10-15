/**
 * Email verification and employment re-checks. The original provider result is always stored.
 * A free DNS check can only prove a domain cannot receive mail; it never upgrades a status to "valid".
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { contactEvidence, contacts, contactVerifications } from "../db/schema.ts";
import { logEvent } from "../events.ts";
import { withBudget } from "../jobs/budget.ts";
import { emailVerifier } from "../providers/index.ts";
import { getSettings } from "../settings.ts";
import { recordContactEvent, refreshDerived } from "../services/contacts.ts";
import { containsVerbatim } from "./extract.ts";
import { PoliteFetcher } from "./fetcher.ts";

export type VerifyOutcome = { status: string; message: string; provider: string; credits: number };

export async function verifyEmail(contactId: string, ctx: { runId?: string | null; taskId?: string | null } = {}): Promise<VerifyOutcome> {
  const [c] = await db().select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!c?.emailNormalized) return { status: "skipped", message: "Brak adresu do weryfikacji.", provider: "-", credits: 0 };
  const verifier = emailVerifier();
  const result = await withBudget(
    { provider: verifier.name, operation: "email-verifier", credits: verifier.paid ? verifier.creditsPerCall : 0, runId: ctx.runId, taskId: ctx.taskId, detail: contactId },
    async () => {
      const r = await verifier.verify(c.emailNormalized!);
      return { value: r, credits: r.credits };
    },
  );
  await db()
    .insert(contactVerifications)
    .values({
      contactId,
      email: c.emailNormalized,
      provider: result.provider,
      status: result.status,
      providerStatus: result.providerStatus,
      score: result.score,
      raw: result.raw as Record<string, unknown>,
    });
  if (result.pending) {
    return { status: "pending", message: "Dostawca wciąż weryfikuje adres — sprawdź ponownie za kilka minut.", provider: result.provider, credits: 0 };
  }
  const set: Partial<typeof contacts.$inferInsert> = { updatedAt: new Date() };
  if (verifier.paid) {
    set.emailStatus = result.status;
    set.emailCheckedAt = new Date();
    set.emailProviderResult = { provider: result.provider, raw: result.raw, at: new Date().toISOString() };
  } else if (result.status === "invalid") {
    set.emailStatus = "invalid";
    set.emailCheckedAt = new Date();
    set.emailProviderResult = { provider: result.provider, raw: result.raw, at: new Date().toISOString() };
  }
  await db().update(contacts).set(set).where(eq(contacts.id, contactId));
  await recordContactEvent(contactId, "email_verified", { provider: result.provider, status: result.status, providerStatus: result.providerStatus });
  await refreshDerived([contactId]);
  const message = verifier.paid
    ? `Wynik weryfikacji (${result.provider}): ${result.providerStatus}.`
    : result.status === "invalid"
      ? "Domena nie przyjmuje poczty — adres oznaczono jako nieprawidłowy."
      : "Domena przyjmuje pocztę (sprawdzenie DNS). To nie jest weryfikacja skrzynki — skonfiguruj dostawcę weryfikacji, aby sprawdzić adres.";
  return { status: result.status, message, provider: result.provider, credits: result.credits };
}

export type EmploymentOutcome = { status: "confirmed" | "missing" | "unavailable" | "no_source"; url?: string };

/** Re-fetch the source page that named this person; confirm they are still listed there. */
export async function recheckEmployment(contactId: string, fetcher?: PoliteFetcher): Promise<EmploymentOutcome> {
  const [c] = await db().select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!c || c.kind !== "person" || !c.fullName) return { status: "no_source" };
  const ev = await db()
    .select()
    .from(contactEvidence)
    .where(and(eq(contactEvidence.contactId, contactId), eq(contactEvidence.kind, "source_page")))
    .orderBy(desc(contactEvidence.observedAt))
    .limit(3);
  const urls = [...new Set(ev.map((e) => e.url).filter((u): u is string => Boolean(u)))];
  if (urls.length === 0) return { status: "no_source" };
  const s = await getSettings("discovery");
  const f = fetcher ?? new PoliteFetcher({ minDelayMs: s.minDelayMsPerHost });
  let reachable = false;
  for (const url of urls) {
    const r = await f.get(url);
    if (!r.ok) continue;
    reachable = true;
    if (containsVerbatim(r.body.replace(/<[^>]+>/g, " "), c.fullName)) {
      await db().update(contacts).set({ employmentStatus: "confirmed_recent", employmentCheckedAt: new Date(), updatedAt: new Date() }).where(eq(contacts.id, contactId));
      await db().update(contactEvidence).set({ observedAt: new Date() }).where(and(eq(contactEvidence.contactId, contactId), eq(contactEvidence.url, url)));
      await recordContactEvent(contactId, "employment_confirmed", { url });
      await refreshDerived([contactId]);
      return { status: "confirmed", url };
    }
  }
  if (reachable) {
    await db().update(contacts).set({ employmentStatus: "possibly_left", employmentCheckedAt: new Date(), updatedAt: new Date() }).where(eq(contacts.id, contactId));
    await recordContactEvent(contactId, "employment_missing_from_source", { urls });
    await refreshDerived([contactId]);
    return { status: "missing" };
  }
  return { status: "unavailable" };
}

/** "Sprawdź ponownie" in the UI: email verification plus an employment check where a source page exists. */
export async function verifyContactNow(contactId: string): Promise<{ message: string }> {
  const parts: string[] = [];
  try {
    const v = await verifyEmail(contactId);
    parts.push(v.message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    parts.push(`Weryfikacja adresu nie powiodła się: ${msg}`);
    await logEvent("warning", "provider", "Ręczna weryfikacja nie powiodła się", { contactId, message: msg.slice(0, 200) });
  }
  const emp = await recheckEmployment(contactId).catch(() => ({ status: "unavailable" as const }));
  if (emp.status === "confirmed") parts.push("Osoba nadal widnieje na stronie źródłowej.");
  if (emp.status === "missing") parts.push("Osoby nie ma już na stronie źródłowej — możliwa zmiana pracy.");
  if (emp.status === "unavailable") parts.push("Strona źródłowa jest niedostępna — zatrudnienia nie sprawdzono.");
  return { message: parts.join(" ") };
}
