"use client";

import { Building2, ExternalLink as Ext, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import { Dot, Empty, SkeletonRows } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { SECTOR_LABEL, SIZE_LABEL } from "@/lib/contact-query";
import { formatWarsaw } from "@/lib/time";
import type { Coverage } from "@/server/services/companies";

type Row = {
  id: string;
  name: string;
  brand: string | null;
  domain: string;
  website: string | null;
  sector: string;
  sizeBand: string;
  sizeBasis: string;
  employeesPoland: { value: number } | null;
  employeesGlobal: { value: number } | null;
  origin: string;
  researchStatus: string;
  researchOutcome: string | null;
  lastResearchedAt: string | null;
  nextResearchAt: string | null;
  prioritySignals: { signal: string; url: string }[];
  excluded: boolean;
  contacts: number;
  relevant: number;
};

const OUTCOME: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "hollow" | "accent" }> = {
  relevant_contact_found: { label: "Trafny kontakt", tone: "ok" },
  person_found_email_unavailable: { label: "Osoba bez adresu", tone: "warn" },
  department_found_no_named_contact: { label: "Dział bez osoby", tone: "warn" },
  general_contact_only: { label: "Tylko kontakt ogólny", tone: "warn" },
  needs_provider_enrichment: { label: "Do uzupełnienia u dostawcy", tone: "warn" },
  no_suitable_contact: { label: "Brak odpowiedniego kontaktu", tone: "bad" },
  source_unavailable: { label: "Strona niedostępna", tone: "bad" },
  research_incomplete: { label: "Badanie niepełne", tone: "hollow" },
};

export function CompaniesView() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [cov, setCov] = useState<Coverage | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "covered" | "unresolved" | "queued" | "excluded">("all");
  const [sector, setSector] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<{ rows: Row[]; coverage: Coverage }>(
        `/api/companies?coverage=1&limit=1000${filter === "excluded" ? "&status=excluded" : ""}`,
      );
      setRows(r.rows);
      setCov(r.coverage);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nie udało się wczytać firm");
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle && !`${r.name} ${r.brand ?? ""} ${r.domain}`.toLowerCase().includes(needle)) return false;
      if (sector && r.sector !== sector) return false;
      if (filter === "covered") return r.relevant > 0;
      if (filter === "unresolved") return r.relevant === 0 && r.researchStatus !== "queued";
      if (filter === "queued") return r.researchStatus === "queued";
      return true;
    });
  }, [rows, q, sector, filter]);

  async function act(id: string, body: Record<string, unknown>, msg: string) {
    try {
      await apiFetch(`/api/companies/${id}`, { method: "PATCH", body });
      toast(msg);
      void load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie udało się", "error");
    }
  }

  return (
    <div className="stack-lg">
      {cov ? (
        <div className="metrics">
          <div className="metric">
            <div className="metric-value">{cov.total}</div>
            <div className="metric-label">Firmy w zbiorze</div>
            <div className="metric-def">Bez wykluczonych.</div>
          </div>
          <div className="metric">
            <div className="metric-value">{cov.researched}</div>
            <div className="metric-label">Zbadane</div>
            <div className="metric-def">Co najmniej raz przeszły badanie stron. W kolejce: {cov.queued}.</div>
          </div>
          <div className="metric">
            <div className="metric-value">{cov.withRelevantContact}</div>
            <div className="metric-label">Z trafnym kontaktem</div>
            <div className="metric-def">
              Osoba (decydent / organizator) lub skrzynka działu HR, szkoleń lub zakupów — z adresem,
              nieodrzucona.
            </div>
          </div>
          <div className="metric">
            <div className="metric-value">{cov.unresolved}</div>
            <div className="metric-label">Nierozwiązane</div>
            <div className="metric-def">
              Zbadane, ale bez trafnego kontaktu (np. tylko info@, osoba bez adresu).
            </div>
          </div>
        </div>
      ) : null}

      {cov?.bySector.length ? (
        <section className="card card-pad stack">
          <h3>Pokrycie według sektora</h3>
          <div className="stack" style={{ gap: 10 }}>
            {cov.bySector.map((s) => (
              <div key={s.sector} className="row" style={{ gap: 12 }}>
                <span className="small" style={{ width: 230 }}>
                  {SECTOR_LABEL[s.sector] ?? s.sector}
                </span>
                <div
                  className="bar"
                  style={{ flex: 1 }}
                  title={`${s.withRelevant} z ${s.total} z trafnym kontaktem; zbadane ${s.researched}`}
                >
                  <span
                    style={{ width: `${(100 * s.withRelevant) / s.total}%`, background: "var(--accent)" }}
                  />
                  <span
                    style={{
                      width: `${(100 * (s.researched - s.withRelevant)) / s.total}%`,
                      background: "var(--neutral-bar)",
                      opacity: 0.45,
                    }}
                  />
                </div>
                <span className="small muted tabular" style={{ width: 90, textAlign: "right" }}>
                  {s.withRelevant}/{s.total}
                </span>
              </div>
            ))}
            <div className="row xsmall muted" style={{ gap: 14 }}>
              <span className="status">
                <span className="dot dot-accent" /> z trafnym kontaktem
              </span>
              <span className="status">
                <span className="dot dot-neutral" /> zbadane, bez trafnego kontaktu
              </span>
              <span className="status">
                <span className="dot dot-hollow" /> w kolejce
              </span>
            </div>
          </div>
        </section>
      ) : null}

      <div className="toolbar">
        <div className="search">
          <Search size={15} aria-hidden="true" />
          <input
            className="input"
            type="search"
            placeholder="Szukaj firmy lub domeny…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Szukaj firm"
          />
        </div>
        <fieldset className="segmented" aria-label="Status badania">
          {(
            [
              ["all", "Wszystkie"],
              ["covered", "Z kontaktem"],
              ["unresolved", "Nierozwiązane"],
              ["queued", "W kolejce"],
              ["excluded", "Wykluczone"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
        </fieldset>
        <select
          className="select"
          style={{ width: 220 }}
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          aria-label="Sektor"
        >
          <option value="">Wszystkie sektory</option>
          {Object.entries(SECTOR_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap" style={{ maxHeight: "calc(100vh - 260px)" }}>
        <table className="data-table" aria-label="Firmy">
          <thead>
            <tr>
              <th>Firma</th>
              <th>Sektor</th>
              <th>Wielkość</th>
              <th>Wynik badania</th>
              <th>Kontakty</th>
              <th>Ostatnie badanie</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!rows && !error ? (
              <SkeletonRows cols={7} />
            ) : error ? (
              <tr>
                <td colSpan={7}>
                  <Empty title="Nie udało się wczytać firm">{error}</Empty>
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr style={{ cursor: "default" }}>
                <td colSpan={7}>
                  <Empty icon={<Building2 size={22} />} title="Brak firm w tym widoku">
                    Początkowy zbiór firm importujesz poleceniem <code>pnpm research:import</code>; nowe firmy
                    dodaje codzienne odkrywanie.
                  </Empty>
                </td>
              </tr>
            ) : (
              visible.map((r) => {
                const o =
                  r.researchStatus === "queued"
                    ? { label: "W kolejce", tone: "hollow" as const }
                    : (OUTCOME[r.researchOutcome ?? ""] ?? { label: "—", tone: "hollow" as const });
                const emp = r.employeesPoland
                  ? `${r.employeesPoland.value.toLocaleString("pl-PL")} PL`
                  : r.employeesGlobal
                    ? `${r.employeesGlobal.value.toLocaleString("pl-PL")} globalnie`
                    : "brak danych";
                return (
                  <tr key={r.id} style={{ cursor: "default" }}>
                    <td>
                      <div className="cell-stack">
                        <span className="cell-primary ellipsis">
                          {r.brand ?? r.name}
                          {r.prioritySignals.length ? (
                            <span
                              className="tag tag-accent"
                              style={{ marginLeft: 8 }}
                              title={r.prioritySignals.map((s) => s.signal).join("\n")}
                            >
                              L&amp;D
                            </span>
                          ) : null}
                          {r.origin === "discovery" ? (
                            <span className="tag" style={{ marginLeft: 6 }}>
                              nowa
                            </span>
                          ) : null}
                        </span>
                        <span className="cell-sub">
                          {r.website ? (
                            <a
                              href={r.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.domain} <Ext size={10} />
                            </a>
                          ) : (
                            r.domain
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="small secondary">{SECTOR_LABEL[r.sector] ?? r.sector}</td>
                    <td
                      className="small secondary"
                      title={`Podstawa przedziału: ${r.sizeBasis === "poland" ? "zatrudnienie w Polsce" : r.sizeBasis === "global" ? "zatrudnienie globalne" : "brak danych"}`}
                    >
                      {SIZE_LABEL[r.sizeBand as keyof typeof SIZE_LABEL] ?? r.sizeBand}
                      <span className="cell-sub">{emp}</span>
                    </td>
                    <td>
                      <span className="status">
                        <Dot tone={o.tone} />
                        {o.label}
                      </span>
                    </td>
                    <td className="tabular small">
                      {r.contacts > 0 ? (
                        <Link
                          href={`/kontakty?companyId=${r.id}&fallback=include&review=new,accepted,rejected`}
                        >
                          {r.relevant} trafne / {r.contacts}
                        </Link>
                      ) : (
                        <span className="muted">0</span>
                      )}
                    </td>
                    <td className="small secondary tabular">
                      {r.lastResearchedAt ? formatWarsaw(r.lastResearchedAt, "d.MM.yyyy") : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="btn-group" style={{ justifyContent: "flex-end" }}>
                        {!r.excluded ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-quiet btn-sm"
                              onClick={() =>
                                act(r.id, { researchNow: true }, "Dodano do najbliższego przebiegu")
                              }
                            >
                              Zbadaj ponownie
                            </button>
                            <button
                              type="button"
                              className="btn btn-quiet btn-sm"
                              onClick={() => {
                                const reason = window.prompt("Powód wykluczenia (opcjonalnie)") ?? "";
                                void act(
                                  r.id,
                                  { excluded: true, excludedReason: reason },
                                  "Wykluczono — odkrywanie pominie tę firmę",
                                );
                              }}
                            >
                              Wyklucz
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-quiet btn-sm"
                            onClick={() => act(r.id, { excluded: false }, "Przywrócono")}
                          >
                            Przywróć
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="table-footer">
        <span>
          {visible.length} z {rows?.length ?? 0}
        </span>
        <span className="muted">
          Zbiór początkowy: research/companies/universe.jsonl (źródła i daty przy każdej firmie)
        </span>
      </p>
    </div>
  );
}
