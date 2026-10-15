"use client";

import {
  Bell,
  Check,
  Copy,
  ExternalLink as ExtIcon,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { KIND_LABEL, ROLE_FUNCTIONS, ROLE_LABEL, SECTOR_LABEL, SIZE_LABEL } from "@/lib/contact-query";
import { ELIGIBILITY_LABEL, type Eligibility, EMAIL_ORIGIN_LABEL, OUTREACH_LABEL } from "@/lib/contact-rules";
import { FUNCTION_LABEL } from "@/lib/roles";
import { formatWarsaw } from "@/lib/time";
import type { ContactDetail } from "@/server/services/contact-detail";
import { useToast } from "./toast";
import {
  Callout,
  Dialog,
  Dot,
  EmailStatusLabel,
  ExternalLink,
  hostOf,
  OutreachLabel,
  QualityLabel,
} from "./ui";

const EVIDENCE_SUPPORTS: Record<string, string> = {
  name: "osoba",
  role: "rola",
  email: "adres",
  employment: "zatrudnienie",
  department: "dział",
};

export function ContactPanel({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [d, setD] = useState<ContactDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [eligOpen, setEligOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setD(await apiFetch<ContactDetail>(`/api/contacts/${id}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nie udało się wczytać kontaktu.");
    }
  }, [id]);

  useEffect(() => {
    setD(null);
    void load();
  }, [load]);

  useEffect(() => {
    lastFocus.current = document.activeElement as HTMLElement;
    return () => lastFocus.current?.focus?.();
  }, []);

  async function patch(body: Record<string, unknown>, msg: string): Promise<boolean> {
    setBusy(msg);
    try {
      setD(await apiFetch<ContactDetail>(`/api/contacts/${id}`, { method: "PATCH", body }));
      toast(msg);
      onChanged();
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie udało się", "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    try {
      await apiFetch(`/api/contacts/${id}/notes`, { body: { body: note } });
      setNote("");
      void load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie zapisano notatki", "error");
    }
  }

  async function remind(days: number) {
    try {
      await apiFetch(`/api/contacts/${id}/reminders`, { body: { days } });
      toast(`Przypomnienie za ${days} dni`);
      void load();
      onChanged();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie udało się", "error");
    }
  }

  async function findEmail() {
    setBusy("find");
    try {
      const r = await apiFetch<{ message: string }>(`/api/contacts/${id}/find-email`, { body: {} });
      toast(r.message);
      void load();
      onChanged();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Wyszukiwanie nie powiodło się", "error");
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    setBusy("verify");
    try {
      const r = await apiFetch<{ message: string }>(`/api/contacts/${id}/verify`, { body: {} });
      toast(r.message);
      void load();
      onChanged();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Weryfikacja nie powiodła się", "error");
    } finally {
      setBusy(null);
    }
  }

  const c = d?.contact;
  const co = d?.company;
  const title = c
    ? (c.fullName ??
      c.departmentLabel ??
      (c.kind === "general_inbox"
        ? "Adres ogólny"
        : c.kind === "person"
          ? "Osoba (bez nazwiska)"
          : "Skrzynka działu"))
    : "";
  const blocked = d
    ? d.send.blockers.some((b) => /wykluczeń|nie kontaktować|demonstracyjny/i.test(b))
    : false;

  return (
    <aside
      className="panel"
      aria-label={`Kontakt: ${title}`}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="panel-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {c ? (
            <>
              <div className="panel-title ellipsis">{title}</div>
              <div className="secondary small ellipsis" style={{ marginTop: 2 }}>
                {[c.title, co?.brand ?? co?.name].filter(Boolean).join(" · ")}
              </div>
              <div className="row wrap" style={{ marginTop: 10, gap: 12 }}>
                <QualityLabel quality={c.quality} />
                <OutreachLabel status={c.outreachStatus} />
                {c.reviewStatus === "new" ? <span className="tag tag-accent">Do przeglądu</span> : null}
              </div>
            </>
          ) : (
            <span className="skeleton" style={{ width: 200, height: 16 }} />
          )}
        </div>
        <button
          ref={closeRef}
          type="button"
          className="btn btn-quiet btn-icon btn-sm"
          onClick={onClose}
          aria-label="Zamknij panel (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      <div className="panel-body">
        {error ? <Callout tone="bad">{error}</Callout> : null}
        {!d && !error ? (
          <div className="stack" style={{ paddingTop: 8 }}>
            {[70, 90, 60, 80, 50].map((w) => (
              <span key={w} className="skeleton" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : null}
        {d && c ? (
          <>
            {d.send.blockers.length || d.send.warnings.length || d.recentCompanyOutreach.length ? (
              <section className="section stack" style={{ paddingTop: 0 }}>
                {d.send.blockers.some((b) => !b.startsWith("Brak udokumentowanej podstawy")) ? (
                  <Callout tone="bad">
                    <strong>Wysyłka zablokowana</strong>
                    {d.send.blockers
                      .filter((b) => !b.startsWith("Brak udokumentowanej podstawy"))
                      .map((b) => (
                        <span key={b}>{b}</span>
                      ))}
                  </Callout>
                ) : null}
                {d.send.blockers.some((b) => b.startsWith("Brak udokumentowanej podstawy")) ? (
                  <Callout tone="info">
                    <span>
                      Przed wysłaniem zapytamy, skąd wiesz, że możesz tu napisać (zgoda albo zaproszenie do
                      ofert — wymaga tego prawo). To jedno kliknięcie na ekranie maila.
                    </span>
                  </Callout>
                ) : null}
                {d.recentCompanyOutreach.length ? (
                  <Callout tone="warn">
                    <strong>W tej firmie trwa już korespondencja</strong>
                    {d.recentCompanyOutreach.map((r) => (
                      <span key={r.contactId}>
                        {r.who} — wysłano {formatWarsaw(r.at, "d LLL yyyy")} (
                        {OUTREACH_LABEL[r.status as keyof typeof OUTREACH_LABEL] ?? r.status})
                      </span>
                    ))}
                  </Callout>
                ) : null}
                {d.send.warnings.filter((w) => !w.startsWith("W tej firmie")).length ? (
                  <Callout tone="info">
                    {d.send.warnings
                      .filter((w) => !w.startsWith("W tej firmie"))
                      .map((w) => (
                        <span key={w}>{w}</span>
                      ))}
                  </Callout>
                ) : null}
              </section>
            ) : null}

            <section className="section">
              <div className="section-title">Rola i dowody</div>
              <dl className="kv">
                <dt>Rodzaj</dt>
                <dd>{KIND_LABEL[c.kind]}</dd>
                <dt>Dział</dt>
                <dd>
                  <select
                    className="select select-inline"
                    aria-label="Dział"
                    value={c.roleFunction}
                    onChange={(e) => patch({ roleFunction: e.target.value }, "Zmieniono dział")}
                  >
                    {ROLE_FUNCTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f === "other" ? "Nieustalony / inny" : FUNCTION_LABEL[f]}
                      </option>
                    ))}
                  </select>
                </dd>
                <dt>Kategoria</dt>
                <dd>
                  {ROLE_LABEL[c.roleCategory]}
                  {c.roleRationale ? <span className="muted"> · {c.roleRationale}</span> : null}
                </dd>
                {c.title ? (
                  <>
                    <dt>Stanowisko</dt>
                    <dd>{c.title}</dd>
                  </>
                ) : null}
                <dt>Zatrudnienie</dt>
                <dd>
                  {
                    {
                      confirmed_recent: "Potwierdzone niedawno",
                      dated_evidence: "Dowód z datą (może być nieaktualny)",
                      unverified: "Niepotwierdzone",
                      possibly_left: "Możliwa zmiana pracy",
                      left: "Nie pracuje już w firmie",
                    }[c.employmentStatus]
                  }
                  {c.employmentCheckedAt ? (
                    <span className="muted">
                      {" "}
                      · sprawdzono {formatWarsaw(c.employmentCheckedAt, "d.MM.yyyy")}
                    </span>
                  ) : null}
                  {c.sourcePublishedAt ? (
                    <span className="muted"> · źródło z {c.sourcePublishedAt}</span>
                  ) : null}
                </dd>
                <dt>Odkryto</dt>
                <dd>
                  {formatWarsaw(c.discoveredAt, "d LLL yyyy")}{" "}
                  <span className="muted">· {methodLabel(c.discoveryMethod)}</span>
                </dd>
              </dl>
              <p className="xsmall muted" style={{ marginTop: 8 }}>
                Kategoria to ocena na podstawie opublikowanego stanowiska, nie potwierdzenie uprawnień
                zakupowych.
              </p>
              {c.conflicts ? (
                <div style={{ marginTop: 10 }}>
                  <Callout tone="warn">{c.conflicts}</Callout>
                </div>
              ) : null}
              <details className="disclosure" style={{ marginTop: 12 }}>
                <summary>
                  <ShieldCheck size={14} /> Dowody i źródła ({d.evidence.length})
                </summary>
                <div className="disclosure-body">
                  {d.evidence.length === 0 ? <span className="muted">Brak zapisanych dowodów.</span> : null}
                  {d.evidence.map((e) => (
                    <div key={e.id} className="stack" style={{ gap: 4 }}>
                      <div className="row wrap small">
                        <span className="tag">{evidenceKind(e.kind)}</span>
                        {e.supports.map((s) => (
                          <span key={s} className="muted">
                            {EVIDENCE_SUPPORTS[s] ?? s}
                          </span>
                        ))}
                        {e.quoteVerified ? (
                          <span className="status" title="Cytat znaleziony w treści źródła przez kod">
                            <Dot tone="ok" /> cytat potwierdzony
                          </span>
                        ) : null}
                      </div>
                      {e.quote ? <blockquote className="quote">„{e.quote}”</blockquote> : null}
                      <div className="xsmall muted">
                        {e.url ? (
                          <ExternalLink href={e.url}>
                            {hostOf(e.url)} <ExtIcon size={10} />
                          </ExternalLink>
                        ) : null}
                        {e.provider ? ` · ${e.provider}${e.providerRef ? ` (${e.providerRef})` : ""}` : ""}
                        {e.sourcePublishedAt ? ` · opublikowano ${e.sourcePublishedAt}` : ""} · widziane{" "}
                        {formatWarsaw(e.observedAt, "d.MM.yyyy")}
                        {e.note ? ` · ${e.note}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </section>

            <section className="section">
              <div className="section-title">
                E-mail i weryfikacja
                {c.email ? (
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    onClick={verify}
                    disabled={busy === "verify"}
                  >
                    {busy === "verify" ? <span className="spinner" /> : <RefreshCw size={13} />} Sprawdź
                    ponownie
                  </button>
                ) : null}
              </div>
              {c.email ? (
                <dl className="kv">
                  <dt>Adres</dt>
                  <dd className="row">
                    <span>{c.email}</span>
                    <button
                      type="button"
                      className="btn btn-quiet btn-icon btn-sm"
                      aria-label="Kopiuj adres"
                      onClick={() => {
                        void navigator.clipboard.writeText(c.email ?? "");
                        toast("Skopiowano");
                      }}
                    >
                      <Copy size={13} />
                    </button>
                  </dd>
                  <dt>Pochodzenie</dt>
                  <dd>{EMAIL_ORIGIN_LABEL[c.emailOrigin]}</dd>
                  <dt>Weryfikacja</dt>
                  <dd>
                    <EmailStatusLabel status={c.emailStatus} at={c.emailCheckedAt} />
                  </dd>
                </dl>
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  <p className="secondary small">
                    Brak adresu e-mail.{" "}
                    {c.kind === "person"
                      ? "Osoba jest w źródłach, ale jej adres nie został opublikowany."
                      : ""}
                  </p>
                  {c.kind === "person" && d.finder ? (
                    <div className="btn-group">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={findEmail}
                        disabled={busy === "find"}
                      >
                        {busy === "find" ? <span className="spinner" /> : <Search size={13} />} Znajdź adres
                        (Hunter)
                      </button>
                    </div>
                  ) : null}
                  {c.kind === "person" && !d.finder ? (
                    <p className="xsmall muted">
                      Adresy osób uzupełnia Hunter (darmowy plan: 50 adresów miesięcznie) — wystarczy dodać
                      klucz, zob. Ustawienia › Integracje.
                    </p>
                  ) : null}
                </div>
              )}
              <p className="xsmall muted" style={{ marginTop: 8 }}>
                Poprawny technicznie adres nie potwierdza zatrudnienia, tożsamości, trafienia do głównej
                skrzynki ani zgody na korespondencję.
              </p>
              {d.verifications.length ? (
                <details className="disclosure" style={{ marginTop: 10 }}>
                  <summary>Historia weryfikacji ({d.verifications.length})</summary>
                  <div className="disclosure-body small">
                    {d.verifications.map((v) => (
                      <div key={v.id}>
                        {formatWarsaw(v.checkedAt, "d.MM.yyyy HH:mm")} · {v.provider}:{" "}
                        <strong>{v.providerStatus ?? v.status}</strong>
                        {v.score != null ? ` (wynik ${v.score})` : ""}
                        <details>
                          <summary className="xsmall muted">Oryginalny wynik dostawcy</summary>
                          <pre className="mono pre" style={{ margin: "4px 0 0" }}>
                            {JSON.stringify(v.raw, null, 2)}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </section>

            <section className="section">
              <div className="section-title">
                Uprawnienie do kontaktu
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setEligOpen(true)}>
                  Zmień
                </button>
              </div>
              <dl className="kv">
                <dt>Podstawa</dt>
                <dd>{ELIGIBILITY_LABEL[c.eligibilityBasis]}</dd>
                {c.eligibilityBasis !== "not_assessed" ? (
                  <>
                    <dt>Data</dt>
                    <dd>{c.eligibilityDate ?? "—"}</dd>
                    <dt>Zakres</dt>
                    <dd>{c.eligibilityScope ?? "—"}</dd>
                    <dt>Dowód</dt>
                    <dd>
                      {c.eligibilityEvidence ?? "—"}
                      {c.eligibilityEvidenceUrl ? (
                        <>
                          {" "}
                          <ExternalLink href={c.eligibilityEvidenceUrl}>
                            {hostOf(c.eligibilityEvidenceUrl)}
                          </ExternalLink>
                        </>
                      ) : null}
                    </dd>
                  </>
                ) : null}
              </dl>
              <p className="xsmall muted" style={{ marginTop: 8 }}>
                Publiczny adres ani pozytywna weryfikacja nie oznaczają zgody na informację handlową.
                Aplikacja zapisuje Twoją ocenę i dowód — nie rozstrzyga o zgodności z prawem.
              </p>
            </section>

            {co ? (
              <section className="section">
                <div className="section-title">Firma</div>
                <dl className="kv">
                  <dt>Nazwa</dt>
                  <dd>
                    {co.name}
                    {co.website ? (
                      <>
                        {" "}
                        · <ExternalLink href={co.website}>{co.domain}</ExternalLink>
                      </>
                    ) : null}
                  </dd>
                  <dt>Sektor</dt>
                  <dd>{SECTOR_LABEL[co.sector] ?? co.sector}</dd>
                  <dt>Wielkość</dt>
                  <dd>
                    {co.employeesPoland ? (
                      <span>
                        ok. {co.employeesPoland.value.toLocaleString("pl-PL")} w Polsce
                        {co.employeesPoland.asOf ? ` (${co.employeesPoland.asOf})` : ""} ·{" "}
                        <ExternalLink href={co.employeesPoland.sourceUrl}>źródło</ExternalLink>
                      </span>
                    ) : (
                      <span className="muted">Liczba pracowników w Polsce: brak danych</span>
                    )}
                    {co.employeesGlobal ? (
                      <div>
                        {co.employeesGlobal.value.toLocaleString("pl-PL")} globalnie
                        {co.employeesGlobal.asOf ? ` (${co.employeesGlobal.asOf})` : ""} ·{" "}
                        <ExternalLink href={co.employeesGlobal.sourceUrl}>źródło</ExternalLink>
                      </div>
                    ) : null}
                    <div className="xsmall muted">
                      Przedział: {SIZE_LABEL[co.sizeBand as keyof typeof SIZE_LABEL] ?? co.sizeBand}
                    </div>
                  </dd>
                  {co.polishPresenceSummary ? (
                    <>
                      <dt>W Polsce</dt>
                      <dd>
                        {co.polishPresenceSummary}{" "}
                        {co.polishPresenceUrl ? (
                          <ExternalLink href={co.polishPresenceUrl}>dowód</ExternalLink>
                        ) : null}
                      </dd>
                    </>
                  ) : null}
                  {co.parentName ? (
                    <>
                      <dt>Grupa</dt>
                      <dd>{co.parentName}</dd>
                    </>
                  ) : null}
                  {co.prioritySignals.length ? (
                    <>
                      <dt>Sygnały L&amp;D</dt>
                      <dd className="stack" style={{ gap: 4 }}>
                        {co.prioritySignals.map((s) => (
                          <ExternalLink key={s.url + s.signal} href={s.url}>
                            {s.signal}
                          </ExternalLink>
                        ))}
                      </dd>
                    </>
                  ) : null}
                </dl>
                {d.colleagues.length ? (
                  <div style={{ marginTop: 14 }}>
                    <div className="menu-label" style={{ padding: "0 0 6px" }}>
                      Inne kontakty w tej firmie
                    </div>
                    <div className="stack" style={{ gap: 6 }}>
                      {d.colleagues.map((x) => (
                        <div key={x.id} className="row-between small">
                          <span className="ellipsis">
                            {x.fullName ?? x.departmentLabel ?? x.email}
                            {x.title ? <span className="muted"> · {x.title}</span> : null}
                          </span>
                          <OutreachLabel status={x.outreachStatus} at={x.lastContactedAt} />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="section">
              <div className="section-title">Korespondencja</div>
              {d.messages.length === 0 && d.inbound.length === 0 ? (
                <p className="secondary small">Brak korespondencji.</p>
              ) : (
                <ul className="timeline">
                  {[
                    ...d.messages.map((m) => ({
                      at: m.sentAt ?? m.scheduledFor ?? m.createdAt,
                      kind: "out" as const,
                      m,
                    })),
                    ...d.inbound.map((i) => ({ at: i.receivedAt, kind: "in" as const, i })),
                  ]
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .map((e) =>
                      e.kind === "out" ? (
                        <li key={e.m.id}>
                          <Dot
                            tone={
                              e.m.status === "sent"
                                ? "accent"
                                : e.m.status === "failed" || e.m.status === "uncertain"
                                  ? "bad"
                                  : "hollow"
                            }
                          />
                          <div>
                            <Link href={`/wiadomosci/${e.m.id}`}>{e.m.subject || "(bez tematu)"}</Link>
                            <div className="xsmall muted">
                              {messageStatusLabel(e.m.status)} · {formatWarsaw(e.at, "d LLL yyyy, HH:mm")} ·{" "}
                              {e.m.language.toUpperCase()}
                              {e.m.attachments.length ? ` · załączniki: ${e.m.attachments.length}` : ""}
                            </div>
                          </div>
                        </li>
                      ) : (
                        <li key={e.i.id}>
                          <Dot
                            tone={
                              e.i.classification === "human_reply"
                                ? "ok"
                                : e.i.classification === "bounce"
                                  ? "bad"
                                  : "neutral"
                            }
                          />
                          <div>
                            <span>{inboundLabel(e.i.classification)}</span>
                            <div className="xsmall muted">{formatWarsaw(e.at, "d LLL yyyy, HH:mm")}</div>
                          </div>
                        </li>
                      ),
                    )}
                </ul>
              )}
            </section>

            {d.programSuggestions.length ? (
              <section className="section">
                <div className="section-title">Rekomendowany materiał</div>
                <div className="stack" style={{ gap: 6 }}>
                  {d.programSuggestions.slice(0, 2).map((p) => (
                    <div key={p.id} className="row-between small">
                      <span>{p.name}</span>
                      <span className="muted xsmall">
                        {p.why.length ? `dopasowanie: ${p.why.join(", ")}` : "brak wyraźnego dopasowania"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="section">
              <div className="section-title">Notatki i przypomnienia</div>
              <div className="stack">
                <textarea
                  className="textarea"
                  rows={2}
                  placeholder="Szybka notatka…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void addNote();
                  }}
                />
                <div className="row wrap">
                  <button type="button" className="btn btn-sm" onClick={addNote} disabled={!note.trim()}>
                    Zapisz notatkę
                  </button>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => remind(7)}>
                    <Bell size={13} /> Przypomnij za 7 dni
                  </button>
                </div>
                {d.reminders
                  .filter((r) => !r.doneAt)
                  .map((r) => (
                    <div key={r.id} className="row-between small">
                      <span>
                        <Bell size={12} /> {formatWarsaw(r.dueAt, "d LLL yyyy")} {r.note ? `· ${r.note}` : ""}
                      </span>
                      <button
                        type="button"
                        className="link-button xsmall"
                        onClick={async () => {
                          await apiFetch(`/api/contacts/${id}/reminders`, { body: { doneId: r.id } });
                          void load();
                        }}
                      >
                        Gotowe
                      </button>
                    </div>
                  ))}
                {d.notes.map((n) => (
                  <div key={n.id} className="small">
                    <div className="pre">{n.body}</div>
                    <div className="xsmall muted">{formatWarsaw(n.createdAt)}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>

      {d && c ? (
        <div className="panel-footer">
          <Link
            className={`btn btn-primary ${blocked ? "disabled" : ""}`}
            href={blocked ? "#" : `/wiadomosci/nowa?contact=${c.id}`}
            aria-disabled={blocked}
            onClick={(e) => blocked && e.preventDefault()}
          >
            <Mail size={15} /> Przygotuj email
          </Link>
          {c.reviewStatus !== "accepted" ? (
            <button
              type="button"
              className="btn"
              disabled={busy !== null}
              onClick={() => patch({ reviewStatus: "accepted" }, "Zaakceptowano")}
            >
              <Check size={14} /> Akceptuj
            </button>
          ) : null}
          {c.reviewStatus !== "rejected" ? (
            <button
              type="button"
              className="btn btn-quiet"
              disabled={busy !== null}
              onClick={() => patch({ reviewStatus: "rejected" }, "Odrzucono — nie wróci w odkrywaniu")}
            >
              Odrzuć
            </button>
          ) : null}
        </div>
      ) : null}

      {d && c ? (
        <EligibilityDialog
          open={eligOpen}
          onClose={() => setEligOpen(false)}
          contactId={c.id}
          current={c.eligibilityBasis}
          onSaved={() => {
            setEligOpen(false);
            void load();
            onChanged();
          }}
        />
      ) : null}
    </aside>
  );
}

function EligibilityDialog({
  open,
  onClose,
  contactId,
  current,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  contactId: string;
  current: Eligibility;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [basis, setBasis] = useState<Eligibility>(current);
  const [evidence, setEvidence] = useState("");
  const [url, setUrl] = useState("");
  const [scope, setScope] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const needs = ["consent", "invitation_to_offer", "prior_relationship", "other_documented"].includes(basis);
  async function save() {
    try {
      await apiFetch(`/api/contacts/${contactId}/eligibility`, {
        body: {
          basis,
          evidence: evidence || null,
          evidenceUrl: url || null,
          scope: scope || null,
          date: needs ? date : null,
        },
      });
      toast("Zapisano podstawę kontaktu");
      onSaved();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie zapisano", "error");
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Uprawnienie do kontaktu"
      description="Zapisz podstawę, datę, zakres i dowód. To Twoja udokumentowana ocena — aplikacja nie stwierdza zgodności z prawem."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Anuluj
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            Zapisz
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">Podstawa</span>
        <select className="select" value={basis} onChange={(e) => setBasis(e.target.value as Eligibility)}>
          {Object.entries(ELIGIBILITY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className="field-hint">
          {basis === "invitation_to_offer"
            ? "Np. publiczna strona firmy zapraszająca dostawców szkoleń do przesyłania ofert na wskazany adres."
            : basis === "consent"
              ? "Zgoda odbiorcy na otrzymywanie informacji handlowych drogą e-mail — z datą i zakresem."
              : basis === "prior_relationship"
                ? "Np. odbiorca sam zapytał o ofertę lub umówiliście się na przesłanie materiałów."
                : basis === "do_not_contact"
                  ? "Adres trafi na globalną listę wykluczeń."
                  : ""}
        </span>
      </label>
      {needs ? (
        <>
          <label className="field">
            <span className="field-label">Dowód (opis lub cytat)</span>
            <textarea
              className="textarea"
              rows={3}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span className="field-label">Link do dowodu</span>
              <input className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Data</span>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Zakres</span>
            <input
              className="input"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="np. oferty szkoleń menedżerskich, e-mail"
            />
          </label>
        </>
      ) : null}
    </Dialog>
  );
}

function methodLabel(m: string): string {
  return (
    {
      crawler: "strona firmy (automatycznie)",
      provider_hunter: "dostawca: Hunter",
      csv_import: "import CSV",
      manual: "dodany ręcznie",
      research_import: "badanie źródeł publicznych",
      search: "wyszukiwanie w sieci",
    }[m] ?? m
  );
}

function evidenceKind(k: string): string {
  return (
    {
      source_page: "Strona źródłowa",
      provider: "Dostawca",
      search_result: "Wynik wyszukiwania",
      user: "Użytkownik",
      import: "Import",
    }[k] ?? k
  );
}

function messageStatusLabel(s: string): string {
  return (
    {
      draft: "Szkic",
      approved: "Zatwierdzony",
      scheduled: "Zaplanowany",
      sending: "Wysyłanie",
      sent: "Wysłany (przyjęty przez Gmail)",
      failed: "Błąd",
      uncertain: "Wynik niepewny",
      cancelled: "Anulowany",
    }[s] ?? s
  );
}

function inboundLabel(k: string): string {
  return (
    {
      human_reply: "Odpowiedź",
      auto_reply: "Autoodpowiedź",
      bounce: "Zwrot (bounce)",
      unknown: "Wiadomość w wątku",
    }[k] ?? k
  );
}
