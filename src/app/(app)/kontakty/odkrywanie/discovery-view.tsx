"use client";

import { Pause, Play, RefreshCw, Square } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { Callout, Dialog, Dot, Empty } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { formatWarsaw } from "@/lib/time";
import type { DiscoveryStatus } from "@/server/services/discovery-status";

const RUN_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "accent" | "hollow" }> = {
  queued: { label: "W kolejce", tone: "hollow" },
  running: { label: "W toku", tone: "accent" },
  succeeded: { label: "Zakończony", tone: "ok" },
  partial: { label: "Częściowo", tone: "warn" },
  failed: { label: "Błąd", tone: "bad" },
  cancelled: { label: "Anulowany", tone: "hollow" },
  budget_exhausted: { label: "Limit wydatków", tone: "warn" },
};
const TRIGGER: Record<string, string> = {
  schedule: "Harmonogram",
  catch_up: "Nadrobiony",
  manual: "Ręcznie",
};

export function DiscoveryView() {
  const toast = useToast();
  const [s, setS] = useState<DiscoveryStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [runDetail, setRunDetail] = useState<string | null>(null);
  const stop = useRef(false);

  const load = useCallback(async () => {
    try {
      setS(await apiFetch<DiscoveryStatus>("/api/discovery/status"));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nie udało się wczytać stanu.");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  // While the page is open, drive short work slices; the scheduler continues when it's closed.
  async function drive(runId: string) {
    setWorking(true);
    stop.current = false;
    try {
      for (let i = 0; i < 200 && !stop.current; i++) {
        const r = await apiFetch<{ busy: boolean; finished?: boolean; status?: string }>(
          "/api/discovery/work",
          { body: { runId } },
        );
        await load();
        if (r.busy) {
          toast("Przebieg jest właśnie przetwarzany przez harmonogram.");
          break;
        }
        if (r.finished) {
          toast(`Przebieg zakończony: ${RUN_STATUS[r.status ?? ""]?.label ?? r.status}`);
          break;
        }
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Przetwarzanie przerwane", "error");
    } finally {
      setWorking(false);
    }
  }

  async function runNow() {
    try {
      const r = await apiFetch<{ runId: string; reused: boolean }>("/api/discovery/run-now", { body: {} });
      toast(r.reused ? "Trwa już przebieg — kontynuuję go." : "Uruchomiono przebieg.");
      void drive(r.runId);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie udało się uruchomić", "error");
    }
  }

  async function setEnabled(enabled: boolean) {
    if (!s) return;
    await apiFetch("/api/settings/scheduler", { method: "PUT", body: { ...s.scheduler, enabled } });
    toast(enabled ? "Harmonogram wznowiony" : "Harmonogram wstrzymany");
    void load();
  }

  if (error && !s) return <Callout tone="bad">{error}</Callout>;
  if (!s)
    return (
      <div className="stack">
        {[1, 2, 3].map((i) => (
          <span key={i} className="skeleton" style={{ width: `${50 + i * 10}%` }} />
        ))}
      </div>
    );

  const last = s.runs[0];
  const tickOk = s.scheduler.lastTickAt
    ? Date.now() - Date.parse(s.scheduler.lastTickAt) < 3 * 3_600_000
    : false;
  const budgetPct =
    s.discovery.monthlySpendLimitUsd > 0
      ? Math.min(100, (s.spend.monthUsd / s.discovery.monthlySpendLimitUsd) * 100)
      : 0;

  return (
    <div className="stack-lg">
      {!s.integrations.hunter ? (
        <Callout tone="info">
          <span>
            Dostawca danych kontaktowych (Hunter) nie jest skonfigurowany. Odkrywanie działa na publicznych
            stronach firm (bezpłatnie); uzupełnianie adresów i weryfikacja skrzynek wymagają klucza — zob.{" "}
            <Link href="/ustawienia#integracje">Ustawienia</Link>.
          </span>
        </Callout>
      ) : null}
      {s.scheduler.enabled && !tickOk ? (
        <Callout tone="warn">
          <span>
            Harmonogram nie zgłosił się{" "}
            {s.scheduler.lastTickAt ? `od ${formatWarsaw(s.scheduler.lastTickAt)}` : "jeszcze ani razu"}. Bez
            działającego wyzwalacza (Vercel Cron, Cloud Scheduler) codzienne odkrywanie nie ruszy przy
            zamkniętej przeglądarce. Instrukcja: docs/DEPLOYMENT.md.
          </span>
        </Callout>
      ) : null}

      <div className="metrics">
        <div className="metric">
          <div className="metric-value small" style={{ fontSize: 17 }}>
            {s.lastSuccessfulRunAt ? formatWarsaw(s.lastSuccessfulRunAt, "d LLL, HH:mm") : "—"}
          </div>
          <div className="metric-label">Ostatni udany przebieg</div>
        </div>
        <div className="metric">
          <div className="metric-value" style={{ fontSize: 17 }}>
            {s.scheduler.enabled ? formatWarsaw(s.scheduler.nextRunAt, "d LLL, HH:mm") : "Wstrzymany"}
          </div>
          <div className="metric-label">Następny przebieg ({s.scheduler.timezone})</div>
        </div>
        <div className="metric">
          <div className="metric-value">{last?.stats.contactsNew ?? 0}</div>
          <div className="metric-label">Nowe kontakty (ostatni przebieg)</div>
        </div>
        <div className="metric">
          <div className="metric-value">{last?.stats.contactsUpdated ?? 0}</div>
          <div className="metric-label">Zaktualizowane rekordy</div>
        </div>
        <div className="metric">
          <div className="metric-value">{s.coverage.unresolved + s.coverage.queued}</div>
          <div className="metric-label">Firmy bez trafnego kontaktu</div>
        </div>
        <div className="metric">
          <div className="metric-value">${s.spend.monthUsd.toFixed(2)}</div>
          <div className="metric-label">Koszt w tym miesiącu</div>
          <div
            className="bar"
            style={{ marginTop: 8 }}
            role="img"
            aria-label={`Wykorzystano ${budgetPct.toFixed(0)}% limitu`}
          >
            <span
              style={{ width: `${budgetPct}%`, background: budgetPct > 90 ? "var(--bad)" : "var(--accent)" }}
            />
          </div>
          <div className="metric-def">
            Limit: ${s.discovery.monthlySpendLimitUsd}/mies., ${s.discovery.dailySpendLimitUsd}/dzień
          </div>
        </div>
      </div>

      <section className="card card-pad stack">
        <div className="row-between wrap">
          <div>
            <h3>Harmonogram</h3>
            <p className="secondary small" style={{ marginTop: 4 }}>
              Codziennie o {s.scheduler.localTime} ({s.scheduler.timezone}, z uwzględnieniem zmiany czasu).
              Gdy wyzwalacz nie zadziała o czasie, przebieg zostanie nadrobiony tego samego dnia; opuszczone
              dni nie są nadrabiane wstecz.
            </p>
          </div>
          <div className="btn-group">
            {s.scheduler.enabled ? (
              <button type="button" className="btn" onClick={() => setEnabled(false)}>
                <Pause size={14} /> Wstrzymaj
              </button>
            ) : (
              <button type="button" className="btn" onClick={() => setEnabled(true)}>
                <Play size={14} /> Wznów
              </button>
            )}
            <button type="button" className="btn" onClick={() => setSettingsOpen(true)}>
              Ustawienia przebiegu
            </button>
            {working ? (
              <button type="button" className="btn" onClick={() => (stop.current = true)}>
                <Square size={13} /> Zatrzymaj podgląd
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={runNow}>
                <RefreshCw size={14} /> Uruchom teraz
              </button>
            )}
          </div>
        </div>
        {s.active ? (
          <div className="stack" style={{ gap: 6 }}>
            <div className="row small">
              <span className="spinner" aria-hidden="true" style={{ color: "var(--accent)" }} />
              Przebieg w toku: {s.active.progress?.done ?? 0} z {s.active.progress?.total ?? "?"} zadań
              {s.active.progress?.failed ? (
                <span className="muted"> · błędy: {s.active.progress.failed}</span>
              ) : null}
              {!working ? (
                <button type="button" className="link-button" onClick={() => drive(s.active!.id)}>
                  Przetwarzaj teraz
                </button>
              ) : null}
            </div>
            <div className="bar">
              <span
                style={{
                  width: `${s.active.progress?.total ? (100 * s.active.progress.done) / s.active.progress.total : 3}%`,
                  background: "var(--accent)",
                }}
              />
            </div>
            <p className="xsmall muted">
              Możesz zamknąć tę stronę — harmonogram dokończy przebieg w kolejnych cyklach.
            </p>
          </div>
        ) : null}
      </section>

      {s.issues.length ? (
        <section className="stack">
          <h3>Wymaga uwagi</h3>
          <div className="list">
            {s.issues.map((i) => (
              <div key={i.id} className="list-row">
                <Dot tone={i.level === "error" ? "bad" : "warn"} />
                <div className="list-row-main">
                  <div>{i.message}</div>
                  <div className="xsmall muted">
                    {formatWarsaw(i.createdAt)} · {i.category}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={async () => {
                    await apiFetch(`/api/events/${i.id}`, { body: {} });
                    void load();
                  }}
                >
                  Oznacz jako przejrzane
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="stack">
        <h3>Historia przebiegów</h3>
        {s.runs.length === 0 ? (
          <div className="card">
            <Empty
              title="Jeszcze nie było przebiegu"
              actions={
                <button type="button" className="btn btn-primary" onClick={runNow}>
                  Uruchom pierwszy przebieg
                </button>
              }
            >
              Pierwszy przebieg zbada firmy z początkowego zestawu (strony kontaktowe, zespoły, akademie,
              kanały dla dostawców).
            </Empty>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Start</th>
                  <th>Wyzwalacz</th>
                  <th>Status</th>
                  <th>Zbadane firmy</th>
                  <th>Nowe kontakty</th>
                  <th>Nowe firmy</th>
                  <th>Weryfikacje</th>
                  <th>Koszt</th>
                </tr>
              </thead>
              <tbody>
                {s.runs.map((r) => (
                  <tr key={r.id} onClick={() => setRunDetail(r.id)}>
                    <td className="tabular">{formatWarsaw(r.createdAt, "d LLL, HH:mm")}</td>
                    <td className="small secondary">{TRIGGER[r.trigger] ?? r.trigger}</td>
                    <td>
                      <span className="status">
                        <Dot tone={RUN_STATUS[r.status]?.tone ?? "hollow"} />
                        {RUN_STATUS[r.status]?.label ?? r.status}
                      </span>
                    </td>
                    <td className="tabular">{r.stats.companiesResearched ?? 0}</td>
                    <td className="tabular">
                      {(r.stats.contactsNew ?? 0) > 0 ? (
                        <Link
                          href={`/kontakty?runId=${r.id}&fallback=include`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.stats.contactsNew}
                        </Link>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="tabular">{r.stats.companiesDiscovered ?? 0}</td>
                    <td className="tabular">{r.stats.emailsVerified ?? 0}</td>
                    <td className="tabular">${r.costUsd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RunDialog runId={runDetail} onClose={() => setRunDetail(null)} />
      <RunSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        status={s}
        onSaved={load}
      />
    </div>
  );
}

type RunDetail = {
  run: { id: string; status: string; error: string | null; plan: Record<string, unknown> };
  tasks: {
    id: string;
    kind: string;
    key: string;
    status: string;
    attempts: number;
    error: string | null;
    result: Record<string, unknown> | null;
  }[];
};

const TASK_LABEL: Record<string, string> = {
  maintenance: "Odświeżenie statusów",
  find_companies: "Nowe firmy",
  research_company: "Badanie firmy",
  enrich_company: "Uzupełnienie (dostawca)",
  enrich_person: "Adres osoby (dostawca)",
  verify_email: "Weryfikacja adresu",
  recheck_employment: "Sprawdzenie zatrudnienia",
};

function RunDialog({ runId, onClose }: { runId: string | null; onClose: () => void }) {
  const [d, setD] = useState<RunDetail | null>(null);
  useEffect(() => {
    setD(null);
    if (runId)
      apiFetch<RunDetail>(`/api/runs/${runId}`)
        .then(setD)
        .catch(() => {});
  }, [runId]);
  return (
    <Dialog open={Boolean(runId)} onClose={onClose} title="Szczegóły przebiegu" wide>
      {!d ? (
        <span className="skeleton" style={{ width: "60%" }} />
      ) : (
        <div className="stack">
          {d.run.error ? <Callout tone="bad">{d.run.error}</Callout> : null}
          {(d.run.plan as { budgetMessage?: string }).budgetMessage ? (
            <Callout tone="warn">{(d.run.plan as { budgetMessage?: string }).budgetMessage}</Callout>
          ) : null}
          <div className="table-wrap" style={{ maxHeight: 420 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Zadanie</th>
                  <th>Status</th>
                  <th>Wynik</th>
                </tr>
              </thead>
              <tbody>
                {d.tasks.map((t) => (
                  <tr key={t.id} style={{ cursor: "default" }}>
                    <td>{TASK_LABEL[t.kind] ?? t.kind}</td>
                    <td className="small">
                      {t.status}
                      {t.attempts > 1 ? <span className="muted"> · próby: {t.attempts}</span> : null}
                    </td>
                    <td className="small secondary" style={{ whiteSpace: "normal" }}>
                      {t.error ?? summarizeResult(t.kind, t.result)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function summarizeResult(kind: string, r: Record<string, unknown> | null): string {
  if (!r) return "—";
  if (kind === "research_company") {
    const outcome: Record<string, string> = {
      relevant_contact_found: "znaleziono trafny kontakt",
      person_found_email_unavailable: "osoba znaleziona, brak adresu",
      department_found_no_named_contact: "dział znaleziony, bez osoby",
      general_contact_only: "tylko kontakt ogólny",
      no_suitable_contact: "brak odpowiedniego kontaktu",
      source_unavailable: "strona niedostępna",
      research_incomplete: "badanie niepełne",
    };
    return `${outcome[String(r.outcome)] ?? r.outcome} · stron: ${r.pagesFetched ?? 0} · nowe: ${r.created ?? 0}${r.note ? ` · ${r.note}` : ""}`;
  }
  if (kind === "find_companies")
    return `dodano ${r.companiesDiscovered ?? 0} z ${r.considered ?? 0} kandydatów (${r.source})`;
  if (kind === "verify_email") return String(r.message ?? r.status ?? "");
  if (kind === "recheck_employment") return String(r.status ?? "");
  if (kind === "maintenance") return `odświeżono ${r.contactsRefreshed ?? 0}`;
  return String(r.status ?? r.detail ?? "");
}

function RunSettingsDialog({
  open,
  onClose,
  status,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  status: DiscoveryStatus;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [sched, setSched] = useState(status.scheduler);
  const [disc, setDisc] = useState(status.discovery);
  useEffect(() => {
    if (open) {
      setSched(status.scheduler);
      setDisc(status.discovery);
    }
  }, [open, status]);
  const num = (k: keyof typeof disc) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDisc((d) => ({ ...d, [k]: Number(e.target.value) }));
  async function save() {
    try {
      const { nextRunAt: _n, lastTickAt: _l, ...schedValues } = sched;
      await apiFetch("/api/settings/scheduler", { method: "PUT", body: schedValues });
      await apiFetch("/api/settings/discovery", { method: "PUT", body: disc });
      toast("Zapisano");
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie zapisano", "error");
    }
  }
  const field = (label: string, k: keyof typeof disc, hint?: string) => (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className="input" type="number" min={0} step="any" value={disc[k] as number} onChange={num(k)} />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ustawienia przebiegu"
      description="Cele dzienne to limity, nie obowiązkowe kwoty — przy słabej jakości źródeł przebieg zwróci mniej kontaktów."
      wide
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
      <div className="field-row">
        <label className="field">
          <span className="field-label">Godzina przebiegu</span>
          <input
            className="input"
            type="time"
            value={sched.localTime}
            onChange={(e) => setSched((x) => ({ ...x, localTime: e.target.value }))}
          />
          <span className="field-hint">Czas lokalny {sched.timezone}</span>
        </label>
        {field("Nowe firmy na przebieg", "maxNewCompaniesPerRun")}
        {field("Badane firmy na przebieg", "maxCompaniesResearchedPerRun")}
        {field("Maks. nowych kontaktów", "maxNewContactsPerRun")}
      </div>
      <div className="field-row">
        {field(
          "Maks. kontaktów na firmę",
          "maxContactsPerCompany",
          "Zalecane 3–5: po jednym z HR/L&D, zakupów i kierownictwa",
        )}
        {field("Uzupełnienia (płatne) na przebieg", "maxEnrichmentsPerRun")}
        {field("Ponowne sprawdzenia na przebieg", "maxRechecksPerRun")}
        {field("Min. liczba pracowników", "minEmployees", "Kryterium wielkości (konfigurowalne)")}
      </div>
      <div className="field-row">
        {field("Limit dzienny (USD)", "dailySpendLimitUsd")}
        {field("Limit miesięczny (USD)", "monthlySpendLimitUsd")}
        {field("Stron na firmę", "maxPagesPerCompany")}
        {field("Odstęp między zapytaniami (ms)", "minDelayMsPerHost")}
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          className="checkbox"
          checked={disc.includeUnknownSize}
          onChange={(e) => setDisc((d) => ({ ...d, includeUnknownSize: e.target.checked }))}
        />
        Uwzględniaj firmy bez danych o liczbie pracowników
      </label>
      <label className="field">
        <span className="field-label">Wykluczone domeny (po przecinku)</span>
        <input
          className="input"
          value={disc.excludedDomains.join(", ")}
          onChange={(e) =>
            setDisc((d) => ({
              ...d,
              excludedDomains: e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            }))
          }
        />
      </label>
      <label className="field">
        <span className="field-label">Regiony / miasta (opcjonalnie, po przecinku)</span>
        <input
          className="input"
          value={disc.regions.join(", ")}
          onChange={(e) =>
            setDisc((d) => ({
              ...d,
              regions: e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            }))
          }
          placeholder="np. Warszawa, Kraków"
        />
      </label>
      <label className="field">
        <span className="field-label">Słowa wykluczające stanowiska (po przecinku)</span>
        <input
          className="input"
          value={disc.roleExcludeKeywords.join(", ")}
          onChange={(e) =>
            setDisc((d) => ({
              ...d,
              roleExcludeKeywords: e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            }))
          }
        />
      </label>
      <p className="xsmall muted">
        Limity miesięcznych kredytów dostawców:{" "}
        {Object.entries(disc.monthlyProviderCredits)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")}{" "}
        (Ustawienia › Integracje).
      </p>
    </Dialog>
  );
}
