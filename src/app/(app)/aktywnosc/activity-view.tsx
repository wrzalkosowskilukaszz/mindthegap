"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Callout, Dot } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { EMAIL_STATUS_LABEL, type EmailStatus } from "@/lib/contact-rules";
import { formatWarsaw } from "@/lib/time";
import type { ActivityMetrics } from "@/server/services/activity";

const RANGES = [
  { days: 7, label: "7 dni" },
  { days: 30, label: "30 dni" },
  { days: 90, label: "90 dni" },
];

const OPERATION_LABEL: Record<string, string> = {
  "ui:email-generate": "szkice e-maili",
  "ui:email-repair": "poprawki szkiców",
  "ui:email-rewrite": "przeróbki tekstu",
  "ui:material-summary": "streszczenia materiałów",
  "assisted-extraction": "czytanie stron (automatyczne)",
  "domain-search": "wyszukiwanie w domenie",
  "email-finder": "szukanie adresu",
  "email-verifier": "weryfikacja adresu",
  search: "wyszukiwanie firm",
};

const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });

export function ActivityView() {
  const [days, setDays] = useState(30);
  const [m, setM] = useState<ActivityMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setM(null);
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    apiFetch<ActivityMetrics>(`/api/activity?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then(setM)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Nie udało się wczytać"));
  }, [days]);

  if (error) return <Callout tone="bad">{error}</Callout>;
  const metric = (value: number | string, label: string, def: string) => (
    <div className="metric">
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-def">{def}</div>
    </div>
  );
  const maxDay = m ? Math.max(1, ...m.timeline.map((t) => Math.max(t.sent, t.contacts))) : 1;

  return (
    <div className="stack-lg">
      <div className="row-between wrap">
        <fieldset className="segmented" aria-label="Okres">
          {RANGES.map((r) => (
            <button key={r.days} type="button" aria-pressed={days === r.days} onClick={() => setDays(r.days)}>
              {r.label}
            </button>
          ))}
        </fieldset>
        {m ? (
          <span className="small muted">
            {formatWarsaw(m.range.from, "d LLL yyyy")} – {formatWarsaw(m.range.to, "d LLL yyyy")}{" "}
            (Europe/Warsaw)
          </span>
        ) : null}
      </div>

      {!m ? (
        <span className="skeleton" style={{ width: "50%" }} />
      ) : (
        <>
          <section className="stack">
            <h3>Badania i baza</h3>
            <div className="metrics">
              {metric(
                m.coverage.researched,
                "Zbadane firmy",
                `Łącznie (w okresie: ${m.companiesResearchedInPeriod}). Zbiór: ${m.coverage.total} firm.`,
              )}
              {metric(
                m.coverage.withRelevantContact,
                "Firmy z trafnym kontaktem",
                "Osoba lub skrzynka działu HR, szkoleń lub zakupów — z adresem.",
              )}
              {metric(
                m.newContacts,
                "Nowe kontakty w okresie",
                "Dodane przez odkrywanie, import lub ręcznie.",
              )}
              {metric(
                `$${m.costTotalUsd.toFixed(2)}`,
                "Koszt danych w okresie",
                "Płatne wyszukiwania i weryfikacje (zatwierdzone wg cennika).",
              )}
            </div>
            <div className="card card-pad">
              <div className="small secondary" style={{ marginBottom: 10 }}>
                Adresy według weryfikacji (bez odrzuconych)
              </div>
              <div className="row wrap" style={{ gap: 18 }}>
                {Object.entries(m.byVerification).map(([k, n]) => (
                  <span key={k} className="status">
                    <Dot
                      tone={
                        k === "valid"
                          ? "ok"
                          : k === "invalid"
                            ? "bad"
                            : k === "not_checked"
                              ? "hollow"
                              : "warn"
                      }
                    />
                    {EMAIL_STATUS_LABEL[k as EmailStatus] ?? k}: <strong className="tabular">{n}</strong>
                  </span>
                ))}
                {Object.keys(m.byVerification).length === 0 ? (
                  <span className="small muted">Brak adresów.</span>
                ) : null}
              </div>
            </div>
          </section>

          <section className="stack">
            <h3>Korespondencja</h3>
            <div className="metrics">
              {metric(
                m.uniqueContacted,
                "Osoby, do których napisano",
                "Unikalni odbiorcy w okresie (nie liczba wiadomości).",
              )}
              {metric(
                m.messagesSent,
                "Wysłane wiadomości",
                "Przyjęte przez Gmail lub oznaczone ręcznie. To nie dowód doręczenia.",
              )}
              {metric(
                m.humanReplies,
                "Odpowiedzi",
                `Bez autoodpowiedzi (${m.autoReplies}) i zwrotów. Klasyfikację można poprawić w Wiadomościach.`,
              )}
              {metric(
                m.awaitingReply,
                "Czekają na odpowiedź",
                "Kontakty po wysyłce, bez odpowiedzi (stan obecny).",
              )}
              {metric(
                m.bounces + m.failedOrUncertain,
                "Zwroty i błędy",
                `Zwroty: ${m.bounces}; nieudane lub niepewne wysyłki: ${m.failedOrUncertain}.`,
              )}
            </div>
          </section>

          <section className="card card-pad stack">
            <h3>Dzień po dniu</h3>
            <div
              className="row"
              style={{
                alignItems: "flex-end",
                gap: 3,
                height: 120,
                borderBottom: "1px solid var(--separator)",
              }}
              role="img"
              aria-label="Nowe kontakty i wysłane wiadomości dziennie"
            >
              {m.timeline.map((t) => (
                <div
                  key={t.day}
                  title={`${t.day}: nowe kontakty ${t.contacts}, wysłane ${t.sent}, odpowiedzi ${t.replies}`}
                  style={{ flex: 1, display: "flex", gap: 1, alignItems: "flex-end", height: "100%" }}
                >
                  <span
                    style={{
                      flex: 1,
                      height: `${(100 * t.contacts) / maxDay}%`,
                      background: "var(--separator-strong)",
                      borderRadius: 2,
                      minHeight: t.contacts ? 2 : 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      height: `${(100 * t.sent) / maxDay}%`,
                      background: "var(--accent)",
                      borderRadius: 2,
                      minHeight: t.sent ? 2 : 0,
                    }}
                  />
                </div>
              ))}
            </div>
            {m.timeline.length > 1 ? (
              <div className="row-between xsmall muted tabular" style={{ marginTop: -4 }}>
                <span>{dayLabel(m.timeline[0]!.day)}</span>
                <span>{dayLabel(m.timeline[m.timeline.length - 1]!.day)}</span>
              </div>
            ) : null}
            <div className="row xsmall muted" style={{ gap: 14 }}>
              <span className="status">
                <span className="dot" style={{ background: "var(--separator-strong)" }} /> nowe kontakty
              </span>
              <span className="status">
                <span className="dot dot-accent" /> wysłane
              </span>
            </div>
          </section>

          <section className="stack" id="zdarzenia">
            <h3>Przebiegi i koszty</h3>
            <div className="card card-pad row wrap" style={{ gap: 18 }}>
              {Object.entries(m.runs).map(([k, n]) => (
                <span key={k} className="small">
                  {k}: <strong>{n}</strong>
                </span>
              ))}
              {m.costs.map((c) => (
                <span key={`${c.provider}-${c.operation}`} className="small secondary">
                  {c.provider === "anthropic" ? "AI" : c.provider} ·{" "}
                  {OPERATION_LABEL[c.operation] ?? c.operation}:{" "}
                  {c.provider === "anthropic"
                    ? `${Math.round(Number(c.credits))} tys. tokenów`
                    : `${Number(c.credits).toFixed(1)} kr.`}{" "}
                  (≈ ${Number(c.usd).toFixed(2)})
                </span>
              ))}
              <Link href="/kontakty/odkrywanie" className="small">
                Historia przebiegów
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
