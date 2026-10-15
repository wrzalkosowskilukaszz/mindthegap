"use client";

import { LogOut, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { Callout, Dot } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { formatWarsaw } from "@/lib/time";
import type { SystemStatus } from "@/server/services/status";
import type { SettingsOf } from "@/server/settings";

type Overview = {
  status: SystemStatus;
  freshness: SettingsOf<"freshness">;
  outreach: SettingsOf<"outreach">;
  privacy: SettingsOf<"privacy">;
  discovery: SettingsOf<"discovery">;
};
type Suppression = {
  id: string;
  kind: string;
  value: string;
  reason: string | null;
  source: string;
  createdAt: string;
};

export function SettingsView() {
  const toast = useToast();
  const sp = useSearchParams();
  const [o, setO] = useState<Overview | null>(null);
  const [supp, setSupp] = useState<Suppression[]>([]);
  const load = useCallback(async () => {
    setO(await apiFetch<Overview>("/api/settings-overview"));
    setSupp((await apiFetch<{ rows: Suppression[] }>("/api/suppressions")).rows);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const g = sp.get("gmail");
    if (g === "connected") toast("Gmail połączony");
    if (g === "denied") toast("Nie udzielono zgody w Google", "error");
    if (g === "error") toast(`Błąd połączenia: ${sp.get("detail") ?? ""}`, "error");
  }, [sp, toast]);

  async function save(key: "freshness" | "outreach" | "privacy" | "discovery", value: unknown) {
    try {
      await apiFetch(`/api/settings/${key}`, { method: "PUT", body: value });
      toast("Zapisano");
      void load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie zapisano", "error");
    }
  }

  if (!o) return <span className="skeleton" style={{ width: "40%" }} />;
  const s = o.status;
  const g = s.gmail;

  return (
    <div className="stack-lg">
      <section className="card card-pad stack">
        <h3>Na skróty</h3>
        <div className="link-list">
          <Link href="/kontakty/odkrywanie" className="link-row">
            <span>
              <strong>Wyszukiwanie kontaktów</strong>
              <span className="small secondary">
                Kiedy aplikacja szuka nowych firm i adresów, ile to kosztuje, „Szukaj teraz”.
              </span>
            </span>
            <span aria-hidden="true">›</span>
          </Link>
          <Link href="/aktywnosc" className="link-row">
            <span>
              <strong>Statystyki</strong>
              <span className="small secondary">Znalezione kontakty, wysłane maile, odpowiedzi.</span>
            </span>
            <span aria-hidden="true">›</span>
          </Link>
        </div>
      </section>
      <section className="card card-pad stack" id="gmail">
        <h3>Gmail (opcjonalnie)</h3>
        <p className="small secondary">
          Bez Gmaila aplikacja działa w pełni: kopiujesz treść lub otwierasz ją w swoim programie pocztowym i
          oznaczasz jako wysłaną. Połączenie Gmaila pozwala wysyłać jednym kliknięciem i automatycznie śledzić
          odpowiedzi. Nigdy nie prosimy o hasło do Gmaila — logujesz się w Google.
        </p>
        {!s.integrations.google ? (
          <Callout tone="info">
            Połączenie z Google nie jest skonfigurowane na serwerze (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
            Instrukcja: docs/SETUP.md › Gmail.
          </Callout>
        ) : null}
        <dl className="kv">
          <dt>Konto</dt>
          <dd>
            {g ? (
              <span className="status">
                <Dot
                  tone={g.status === "connected" ? "ok" : g.status === "needs_reauth" ? "bad" : "hollow"}
                />
                {g.email} ·{" "}
                {g.status === "connected"
                  ? "połączone"
                  : g.status === "needs_reauth"
                    ? "wymaga ponownej autoryzacji"
                    : "rozłączone"}
              </span>
            ) : (
              "niepołączone"
            )}
          </dd>
          <dt>Wysyłka</dt>
          <dd>{g?.canSend ? "włączona (gmail.send)" : "wyłączona"}</dd>
          <dt>Śledzenie odpowiedzi</dt>
          <dd>
            {g?.canRead
              ? `włączone (tylko nagłówki: gmail.metadata) · ostatnia synchronizacja ${formatWarsaw(g.lastSyncAt)}${g.lastSyncOk === false ? " — błąd" : ""}`
              : "wyłączone — odpowiedzi oznaczasz ręcznie"}
          </dd>
        </dl>
        {g?.lastSyncError ? <Callout tone="warn">{g.lastSyncError}</Callout> : null}
        {s.integrations.google ? (
          <div className="btn-group">
            <a className="btn btn-primary" href="/api/google/connect?purpose=send">
              {g?.canSend ? "Połącz ponownie (wysyłka)" : "Połącz Gmail: wysyłka"}
            </a>
            <a className="btn" href="/api/google/connect?purpose=read">
              {g?.canRead ? "Odnów śledzenie odpowiedzi" : "Włącz śledzenie odpowiedzi"}
            </a>
            {g?.canRead ? (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={async () => {
                  const r = await apiFetch<{ replies: number; error?: string }>("/api/google/sync", {
                    body: {},
                  }).catch((e) => ({ replies: 0, error: e instanceof Error ? e.message : "Błąd" }));
                  toast(r.error ? r.error : `Zsynchronizowano: nowe odpowiedzi ${r.replies}`);
                  void load();
                }}
              >
                Synchronizuj teraz
              </button>
            ) : null}
            {g && g.status !== "disconnected" ? (
              <button
                type="button"
                className="btn btn-quiet btn-danger"
                onClick={async () => {
                  if (!window.confirm("Rozłączyć Gmail? Google cofnie wszystkie uprawnienia tej aplikacji."))
                    return;
                  await apiFetch("/api/google/disconnect", { body: {} });
                  void load();
                }}
              >
                Rozłącz
              </button>
            ) : null}
          </div>
        ) : null}
        <p className="xsmall muted">
          Uprawnienia są osobne: wysyłka (gmail.send) i odczyt samych nagłówków do śledzenia odpowiedzi
          (gmail.metadata) — bez dostępu do treści skrzynki. Google łączy je w jedną autoryzację, więc
          rozłączenie cofa obie.
        </p>
      </section>

      <section className="card card-pad stack" id="integracje">
        <h3>Integracje</h3>
        <dl className="kv">
          {(
            [
              ["AI (Claude)", s.integrations.ai, "pisanie szkiców, streszczenia ofert", "ANTHROPIC_API_KEY"],
              [
                "Hunter.io",
                s.integrations.hunter,
                "adresy ze źródłami i weryfikacja skrzynek",
                "HUNTER_API_KEY",
              ],
              [
                "Tavily",
                s.integrations.search,
                "szukanie podstron HR, akademii i zakupów na stronie firmy (opcjonalnie)",
                "TAVILY_API_KEY",
              ],
              ["Google OAuth", s.integrations.google, "Gmail (opcjonalnie)", "GOOGLE_CLIENT_ID/SECRET"],
            ] as const
          ).map(([name, on, what, env]) => (
            <div key={name} style={{ display: "contents" }}>
              <dt>{name}</dt>
              <dd>
                <span className="status">
                  <Dot tone={on ? "ok" : "hollow"} />
                  {on ? "skonfigurowane" : `oczekuje na konfigurację (${env})`}
                </span>
                <div className="xsmall muted">{what}</div>
              </dd>
            </div>
          ))}
          <dt>Wysyłka realna</dt>
          <dd>
            {s.integrations.sendingEnabled
              ? "włączona (SENDING_ENABLED=true)"
              : "wyłączona w tym środowisku (bezpiecznik SENDING_ENABLED)"}
          </dd>
        </dl>
        <p className="xsmall muted">
          Klucze są przechowywane wyłącznie po stronie serwera (zmienne środowiskowe), nigdy w przeglądarce.
        </p>
        <NumberRow
          label="Miesięczny limit kredytów Hunter"
          value={o.discovery.monthlyProviderCredits.hunter ?? 0}
          hint="Plan Free: 50. Starter: 2000."
          onSave={(v) =>
            save("discovery", {
              ...o.discovery,
              monthlyProviderCredits: { ...o.discovery.monthlyProviderCredits, hunter: v },
            })
          }
        />
        <NumberRow
          label="Miesięczny limit kredytów Tavily"
          value={o.discovery.monthlyProviderCredits.tavily ?? 0}
          hint="Plan darmowy: 1000."
          onSave={(v) =>
            save("discovery", {
              ...o.discovery,
              monthlyProviderCredits: { ...o.discovery.monthlyProviderCredits, tavily: v },
            })
          }
        />
      </section>

      <section className="card card-pad stack">
        <h3>Świeżość danych</h3>
        <p className="xsmall muted">
          To zasady operacyjne, nie gwarancje: adres może przestać działać, a osoba zmienić pracę w dowolnym
          momencie.
        </p>
        <div className="field-row">
          <NumberField
            label="Ponowna weryfikacja adresu (dni)"
            value={o.freshness.emailReverifyDays}
            onSave={(v) => save("freshness", { ...o.freshness, emailReverifyDays: v })}
          />
          <NumberField
            label="Sprawdzenie zatrudnienia (dni)"
            value={o.freshness.employmentRecheckDays}
            onSave={(v) => save("freshness", { ...o.freshness, employmentRecheckDays: v })}
          />
          <NumberField
            label="Ostrzeżenie o starym źródle (dni)"
            value={o.freshness.staleWarningDays}
            onSave={(v) => save("freshness", { ...o.freshness, staleWarningDays: v })}
          />
          <NumberField
            label="Powrót do firm bez kontaktu (dni)"
            value={o.freshness.revisitNoContactDays}
            onSave={(v) => save("freshness", { ...o.freshness, revisitNoContactDays: v })}
          />
        </div>
      </section>

      <section className="card card-pad stack">
        <h3>Korespondencja</h3>
        <div className="field-row">
          <NumberField
            label="Follow-up po (dni)"
            value={o.outreach.followUpDays}
            onSave={(v) => save("outreach", { ...o.outreach, followUpDays: v })}
          />
          <NumberField
            label="Ostrzeżenie o firmie (dni)"
            value={o.outreach.recentCompanyContactDays}
            onSave={(v) => save("outreach", { ...o.outreach, recentCompanyContactDays: v })}
          />
          <NumberField
            label="Dzienny limit wysyłki"
            value={o.outreach.dailySendLimit}
            onSave={(v) => save("outreach", { ...o.outreach, dailySendLimit: v })}
          />
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            className="checkbox"
            checked={o.outreach.requireEligibilityBasis}
            onChange={(e) => save("outreach", { ...o.outreach, requireEligibilityBasis: e.target.checked })}
          />
          Wymagaj zapisanej podstawy kontaktu przed wysyłką (zalecane — art. 398 PKE)
        </label>
      </section>

      <section className="card card-pad stack" id="prywatnosc">
        <h3>Prywatność</h3>
        <div className="field-row">
          <NumberField
            label="Usuń nieprzejrzane, bez kontaktu po (mies.)"
            value={o.privacy.retentionMonthsNotContacted}
            onSave={(v) => save("privacy", { ...o.privacy, retentionMonthsNotContacted: v })}
          />
          <NumberField
            label="Usuń odrzucone po (mies.)"
            value={o.privacy.retentionMonthsRejected}
            onSave={(v) => save("privacy", { ...o.privacy, retentionMonthsRejected: v })}
          />
        </div>
        <p className="xsmall muted">
          RODO (art. 14): osoby, których dane pochodzą z publicznych źródeł, należy poinformować najpóźniej
          przy pierwszym kontakcie i nie później niż w ciągu miesiąca od pozyskania. Usunięte osoby są
          zapamiętywane tylko jako skrót (SHA-256), aby odkrywanie nie dodało ich ponownie. Szczegóły:
          docs/research/LEGAL-PL.md (informacje, nie porada prawna).
        </p>
        <label className="field">
          <span className="field-label">Administrator danych (do stopki)</span>
          <input
            className="input"
            defaultValue={o.privacy.controllerName}
            onBlur={(e) =>
              e.target.value !== o.privacy.controllerName &&
              save("privacy", { ...o.privacy, controllerName: e.target.value })
            }
            placeholder="np. Imię Nazwisko, Mind the Gap"
          />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            className="checkbox"
            checked={o.privacy.includePrivacyFooter}
            onChange={(e) => save("privacy", { ...o.privacy, includePrivacyFooter: e.target.checked })}
          />
          Dodawaj krótką informację o źródle danych i prawie sprzeciwu do pierwszej wiadomości
        </label>
        <div className="grid-2">
          <label className="field">
            <span className="field-label">Stopka PL</span>
            <textarea
              className="textarea"
              rows={4}
              defaultValue={o.privacy.footerPl}
              onBlur={(e) =>
                e.target.value !== o.privacy.footerPl &&
                save("privacy", { ...o.privacy, footerPl: e.target.value })
              }
            />
          </label>
          <label className="field">
            <span className="field-label">Footer EN</span>
            <textarea
              className="textarea"
              rows={4}
              defaultValue={o.privacy.footerEn}
              onBlur={(e) =>
                e.target.value !== o.privacy.footerEn &&
                save("privacy", { ...o.privacy, footerEn: e.target.value })
              }
            />
          </label>
        </div>
        <div className="btn-group">
          <a className="btn" href="/api/privacy/export">
            Eksportuj wszystkie dane (JSON)
          </a>
          <a className="btn" href="/api/contacts/export?view=all">
            Eksportuj kontakty (CSV)
          </a>
        </div>
      </section>

      <section className="card card-pad stack" id="wykluczenia">
        <h3>Lista wykluczeń</h3>
        <p className="xsmall muted">
          Działa globalnie: przy imporcie, ponownym odkryciu i tuż przed każdą wysyłką.
        </p>
        <AddSuppression onAdded={load} />
        {supp.length ? (
          <div className="list">
            {supp.slice(0, 200).map((x) => (
              <div key={x.id} className="list-row small">
                <span className="tag">
                  {{
                    email: "adres",
                    domain: "domena",
                    company: "firma",
                    contact: "kontakt",
                    email_sha256: "usunięty (skrót)",
                    person_sha256: "usunięta osoba (skrót)",
                  }[x.kind] ?? x.kind}
                </span>
                <span className="list-row-main ellipsis">
                  {x.kind.endsWith("sha256") ? `${x.value.slice(0, 12)}…` : x.value}
                </span>
                <span className="muted xsmall">{x.reason}</span>
                <button
                  type="button"
                  className="btn btn-quiet btn-icon btn-sm"
                  aria-label="Usuń z listy"
                  onClick={async () => {
                    await apiFetch(`/api/suppressions/${x.id}`, { method: "DELETE" });
                    void load();
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="small secondary">Lista jest pusta.</p>
        )}
      </section>

      <section className="row-between">
        <span className="small muted">Ostatni cykl harmonogramu: {formatWarsaw(s.scheduler.lastTickAt)}</span>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={async () => {
            await apiFetch("/api/auth/logout", { body: {} });
            window.location.assign("/login");
          }}
        >
          <LogOut size={15} /> Wyloguj
        </button>
      </section>
    </div>
  );
}

function NumberField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (v: number) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="input"
        type="number"
        min={0}
        defaultValue={value}
        onBlur={(e) => Number(e.target.value) !== value && onSave(Number(e.target.value))}
      />
    </label>
  );
}

function NumberRow({
  label,
  value,
  hint,
  onSave,
}: {
  label: string;
  value: number;
  hint: string;
  onSave: (v: number) => void;
}) {
  return (
    <div className="field-row">
      <label className="field">
        <span className="field-label">{label}</span>
        <input
          className="input"
          type="number"
          min={0}
          defaultValue={value}
          onBlur={(e) => Number(e.target.value) !== value && onSave(Number(e.target.value))}
        />
        <span className="field-hint">{hint}</span>
      </label>
    </div>
  );
}

function AddSuppression({ onAdded }: { onAdded: () => void }) {
  const toast = useToast();
  const [value, setValue] = useState("");
  const [kind, setKind] = useState<"email" | "domain">("email");
  return (
    <form
      className="row wrap"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await apiFetch("/api/suppressions", { body: { kind, value, reason: "" } });
          setValue("");
          onAdded();
        } catch (err) {
          toast(err instanceof ApiError ? err.message : "Nie dodano", "error");
        }
      }}
    >
      <select
        className="select"
        style={{ width: 120 }}
        value={kind}
        onChange={(e) => setKind(e.target.value as "email" | "domain")}
        aria-label="Rodzaj"
      >
        <option value="email">Adres</option>
        <option value="domain">Domena</option>
      </select>
      <input
        className="input"
        style={{ flex: 1, minWidth: 200 }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={kind === "email" ? "adres@firma.pl" : "firma.pl"}
        aria-label="Wartość"
      />
      <button type="submit" className="btn" disabled={value.trim().length < 3}>
        Dodaj
      </button>
    </form>
  );
}
