"use client";

import {
  Bookmark,
  BookmarkCheck,
  CalendarClock,
  Check,
  ClipboardList,
  ExternalLink,
  EyeOff,
  MapPin,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { Callout, Empty } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { plural } from "@/lib/plural";
import { daysLeft } from "@/lib/tenders/match";
import { formatWarsaw } from "@/lib/time";
import type { TenderDetailView, TenderList } from "@/server/tenders/service";
import { CompanyMark, ScoreRing } from "../oferty/jobs-view";

type View = "best" | "new" | "closing" | "saved" | "applied" | "all";
const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "best", label: "Pasujące", hint: "Otwarte zapytania, które pasują do Twojej pracy" },
  { id: "new", label: "Nowe", hint: "Znalezione w ostatnich 3 dniach" },
  { id: "closing", label: "Kończą się", hint: "Pasujące, z terminem w ciągu 5 dni" },
  { id: "saved", label: "Zapisane", hint: "Zapisane na później" },
  { id: "applied", label: "Złożone oferty", hint: "Zapytania, na które złożono ofertę" },
  { id: "all", label: "Wszystkie", hint: "Wszystkie otwarte zapytania szkoleniowe" },
];
type Row = TenderList["rows"][number];

function deadlineText(iso: string | null): { text: string; urgent: boolean } {
  if (!iso) return { text: "Termin w ogłoszeniu", urgent: false };
  const d = new Date(iso);
  const left = daysLeft(d);
  const when = formatWarsaw(iso, "d LLL, HH:mm");
  if (left < 0) return { text: `Termin minął (${when})`, urgent: false };
  if (left === 0) return { text: `Termin dziś, ${formatWarsaw(iso, "HH:mm")}`, urgent: true };
  return { text: `Termin ${when} · ${left} ${plural(left, "dzień", "dni", "dni")}`, urgent: left <= 2 };
}

export function TendersView() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<View>((params.get("view") as View) || "best");
  const [near, setNear] = useState(params.get("near") === "1");
  const [q, setQ] = useState("");
  const [data, setData] = useState<TenderList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(params.get("o"));
  const [syncing, setSyncing] = useState(false);
  const [more, setMore] = useState(false);
  const qRef = useRef(q);
  qRef.current = q;

  const query = useCallback(
    (offset = 0) => {
      const u = new URLSearchParams({ view });
      if (near) u.set("near", "1");
      if (qRef.current.trim()) u.set("q", qRef.current.trim());
      if (offset) u.set("offset", String(offset));
      return `/api/tenders?${u}`;
    },
    [view, near],
  );
  const load = useCallback(async () => {
    try {
      setData(await apiFetch<TenderList>(query()));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nie udało się wczytać zapytań");
    }
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  function replaceUrl(mut: (u: URL) => void) {
    const url = new URL(window.location.href);
    mut(url);
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }
  function open(id: string | null) {
    setOpenId(id);
    replaceUrl((u) => (id ? u.searchParams.set("o", id) : u.searchParams.delete("o")));
  }
  function toggleNear() {
    setNear((n) => {
      replaceUrl((u) => (n ? u.searchParams.delete("near") : u.searchParams.set("near", "1")));
      return !n;
    });
  }

  async function loadMore() {
    if (!data) return;
    setMore(true);
    try {
      const next = await apiFetch<TenderList>(query(data.rows.length));
      setData((d) =>
        d
          ? { ...d, rows: [...d.rows, ...next.rows.filter((r) => !d.rows.some((x) => x.id === r.id))] }
          : next,
      );
    } finally {
      setMore(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    try {
      const r = await apiFetch<{ busy: boolean; added?: number }>("/api/tenders/sync", { body: {} });
      if (r.busy) toast("Aplikacja właśnie sprawdza zapytania w tle. Spróbuj za chwilę.");
      else toast(r.added ? `Nowe zapytania: ${r.added}` : "Zapytania zaktualizowane");
      await load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie udało się odświeżyć", "error");
    } finally {
      setSyncing(false);
    }
  }

  if (error) return <Callout tone="bad">{error}</Callout>;
  const counts = data?.counts ?? {};
  return (
    <div className="stack-lg">
      <section className="stat-cards" aria-label="Podsumowanie">
        <button type="button" className="stat-card" onClick={() => setView("best")}>
          <span className="metric-icon">
            <ClipboardList size={22} strokeWidth={1.8} />
          </span>
          <span className="metric-value">{counts.best ?? "–"}</span>
          <span className="metric-label">Pasujące, otwarte</span>
        </button>
        <button type="button" className="stat-card" onClick={() => setView("closing")}>
          <span className="metric-icon">
            <CalendarClock size={22} strokeWidth={1.8} />
          </span>
          <span className="metric-value">{counts.closing ?? "–"}</span>
          <span className="metric-label">Termin w ciągu 5 dni</span>
        </button>
        <button type="button" className="stat-card" onClick={() => setView("applied")}>
          <span className="metric-icon">
            <Send size={22} strokeWidth={1.8} />
          </span>
          <span className="metric-value">{counts.applied ?? "–"}</span>
          <span className="metric-label">Złożone oferty</span>
        </button>
      </section>

      <div className="stack" style={{ gap: 12 }}>
        <div className="views" role="toolbar" aria-label="Widoki zapytań">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              title={v.hint}
              onClick={() => setView(v.id)}
            >
              {v.label}
              {counts[v.id] !== undefined ? <span className="views-count">{counts[v.id]}</span> : null}
            </button>
          ))}
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={15} />
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Szukaj tematu, zamawiającego, miasta…"
              aria-label="Szukaj zapytań"
            />
          </label>
          <button type="button" className="btn btn-sm" aria-pressed={near} onClick={toggleNear}>
            <MapPin size={14} /> {near ? "Warszawa, cała Polska, online" : "Wszystkie miejsca"}
          </button>
          <div className="toolbar-spacer" />
          <span className="small muted hide-mobile">
            {data?.sync.lastSyncAt
              ? `Sprawdzone ${formatWarsaw(data.sync.lastSyncAt, "d LLL, HH:mm")}`
              : "Jeszcze nie sprawdzano"}
          </span>
          <button type="button" className="btn btn-sm" onClick={syncNow} disabled={syncing}>
            {syncing ? <span className="spinner" /> : <RefreshCw size={14} />}{" "}
            {syncing ? "Sprawdzam…" : "Odśwież teraz"}
          </button>
        </div>
      </div>

      {!data ? (
        <div className="job-grid">
          {[1, 2, 3, 4].map((k) => (
            <div key={k} className="job-card">
              <span className="skeleton" style={{ width: "70%" }} />
              <span className="skeleton" style={{ width: "40%" }} />
            </div>
          ))}
        </div>
      ) : data.rows.length === 0 ? (
        <div className="card">
          <Empty
            icon={<ClipboardList size={22} />}
            title={view === "best" ? "Brak pasujących zapytań" : "Pusto"}
          >
            {view === "best"
              ? "Aplikacja sprawdza Bazę Konkurencyjności co 12 godzin. Zajrzyj do „Wszystkie” albo kliknij „Odśwież teraz”."
              : "Nic tu jeszcze nie ma."}
          </Empty>
        </div>
      ) : (
        <div className="job-grid">
          {data.rows.map((r) => (
            <TenderCard key={r.id} r={r} onOpen={() => open(r.id)} active={openId === r.id} />
          ))}
        </div>
      )}

      {data && data.rows.length > 0 && data.rows.length < (counts[view] ?? 0) ? (
        <div className="row" style={{ justifyContent: "center" }}>
          <button type="button" className="btn" onClick={loadMore} disabled={more}>
            {more ? <span className="spinner" /> : null} Pokaż więcej ({data.rows.length} z {counts[view]})
          </button>
        </div>
      ) : null}

      {data ? (
        <p className="xsmall muted">
          Źródło:{" "}
          <a
            href="https://bazakonkurencyjnosci.funduszeeuropejskie.gov.pl/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {data.sync.sourceLine}
          </a>
          {data.sync.lastSyncAt ? `, pobrano ${formatWarsaw(data.sync.lastSyncAt, "d.MM.yyyy, HH:mm")}` : ""}.
          Dane przetworzone: aplikacja wybiera zapytania szkoleniowe ({data.sync.openTotal} otwartych) i
          ocenia dopasowanie prostym rachunkiem ze słów w ogłoszeniu — to nie ocena AI.
        </p>
      ) : null}

      {openId ? <TenderPanel id={openId} onClose={() => open(null)} onChanged={load} /> : null}
    </div>
  );
}

function TenderCard({ r, onOpen, active }: { r: Row; onOpen: () => void; active: boolean }) {
  const dl = deadlineText(r.deadlineAt);
  return (
    <button type="button" className={`job-card${active ? " is-active" : ""}`} onClick={onOpen}>
      <div className="job-card-top">
        <CompanyMark name={r.advertiser} />
        <div className="job-card-head">
          <span className="job-title">{r.title}</span>
          <span className="job-meta">
            {r.advertiser}
            {r.place ? (
              <>
                {" · "}
                <MapPin size={12} /> {r.place}
              </>
            ) : null}
          </span>
        </div>
        <ScoreRing score={r.score} />
      </div>
      <div className="job-reasons">
        {r.reasons.slice(0, 3).map((x) => (
          <span key={x.text} className={`reason reason-${x.tone}`}>
            {x.text}
          </span>
        ))}
      </div>
      <div className="job-card-foot">
        <span className={dl.urgent ? "text-warn" : undefined}>{dl.text}</span>
        {r.status === "saved" ? (
          <span className="tag tag-accent">Zapisane</span>
        ) : r.status === "applied" ? (
          <span className="tag tag-ok">Oferta złożona</span>
        ) : r.closedAt ? (
          <span className="tag">Zamknięte</span>
        ) : null}
      </div>
    </button>
  );
}

function TenderPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<TenderDetailView | null>(null);
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState<"saved" | "pending">("saved");
  const [full, setFull] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef("");
  const saveNote = useCallback(async () => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = null;
    await apiFetch(`/api/tenders/${id}`, { method: "PATCH", body: { note: noteRef.current } }).catch(() =>
      toast("Nie zapisano notatki", "error"),
    );
    setNoteState("saved");
  }, [id, toast]);
  useEffect(
    () => () => {
      if (noteTimer.current) void saveNote();
    },
    [saveNote],
  );
  const load = useCallback(async () => {
    const x = await apiFetch<TenderDetailView>(`/api/tenders/${id}`);
    setD(x);
    setNote(x.note ?? "");
    noteRef.current = x.note ?? "";
  }, [id]);
  useEffect(() => {
    setD(null);
    setFull(false);
    void load().catch(() => toast("Nie udało się wczytać zapytania", "error"));
  }, [load, toast]);

  async function status(s: "new" | "saved" | "applied" | "dismissed", msg: string) {
    await apiFetch(`/api/tenders/${id}`, { method: "PATCH", body: { status: s } });
    toast(msg);
    await load();
    onChanged();
    if (s === "dismissed") onClose();
  }

  const desc = d?.detail?.description || d?.snippet || "";
  const dl = d ? deadlineText(d.deadlineAt) : null;
  return (
    <aside
      className="panel"
      aria-label="Zapytanie ofertowe"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="panel-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {d ? (
            <>
              <div className="panel-title">{d.title}</div>
              <div className="secondary small" style={{ marginTop: 4 }}>
                {d.advertiser}
                {d.place ? ` · ${d.place}` : ""}
              </div>
            </>
          ) : (
            <span className="skeleton" style={{ width: 220, height: 16 }} />
          )}
        </div>
        <button
          type="button"
          className="btn btn-quiet btn-icon btn-sm"
          onClick={onClose}
          aria-label="Zamknij (Esc)"
        >
          <X size={16} />
        </button>
      </div>
      <div className="panel-body">
        {!d || !dl ? (
          <div className="stack">
            <p className="small muted">Pobieram pełną treść z Bazy Konkurencyjności…</p>
            {[80, 60, 90].map((w) => (
              <span key={w} className="skeleton" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : (
          <div className="stack-lg">
            <div className="job-match">
              <ScoreRing score={d.score} size={72} />
              <div className="stack" style={{ gap: 6 }}>
                <strong>Dopasowanie {d.score}%</strong>
                <div className="job-reasons">
                  {d.reasons.map((x) => (
                    <span key={x.text} className={`reason reason-${x.tone}`}>
                      {x.text}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="btn-group">
              <a className="btn btn-primary" href={d.url} target="_blank" rel="noopener noreferrer">
                Otwórz w Bazie <ExternalLink size={14} />
              </a>
              {d.status === "applied" ? (
                <button type="button" className="btn" onClick={() => status("new", "Cofnięto")}>
                  <Check size={14} /> Oferta złożona
                </button>
              ) : (
                <button
                  type="button"
                  className="btn"
                  onClick={() => status("applied", "Oznaczono: oferta złożona")}
                >
                  <Send size={14} /> Oferta złożona
                </button>
              )}
              {d.status === "saved" ? (
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => status("new", "Usunięto z zapisanych")}
                >
                  <BookmarkCheck size={14} /> Zapisane
                </button>
              ) : d.status !== "applied" ? (
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => status("saved", "Zapisano na później")}
                >
                  <Bookmark size={14} /> Zapisz
                </button>
              ) : null}
            </div>

            <dl className="kv">
              <dt>Zamawiający</dt>
              <dd>
                {d.advertiser}
                {d.detail?.advertiserCity ? (
                  <span className="muted"> · {d.detail.advertiserCity}</span>
                ) : null}
              </dd>
              <dt>Termin ofert</dt>
              <dd className={dl.urgent ? "text-warn" : undefined}>{dl.text.replace(/^Termin /, "")}</dd>
              {d.detail?.places.length ? (
                <>
                  <dt>Miejsce</dt>
                  <dd>{d.detail.places.join("; ")}</dd>
                </>
              ) : d.place ? (
                <>
                  <dt>Miejsce</dt>
                  <dd>{d.place}</dd>
                </>
              ) : null}
              {d.number ? (
                <>
                  <dt>Numer</dt>
                  <dd>{d.number}</dd>
                </>
              ) : null}
              {d.publishedOn ? (
                <>
                  <dt>Opublikowano</dt>
                  <dd>{formatWarsaw(`${d.publishedOn}T12:00:00Z`, "d LLL yyyy")}</dd>
                </>
              ) : null}
            </dl>

            <Callout tone="info">
              <span>
                Ofertę składa się zwykle przez Bazę Konkurencyjności (darmowe konto); dokładny sposób, termin
                i formularz podaje samo zapytanie w załącznikach. To zaproszenie do ofert, więc odpowiedź na
                nie nie wymaga osobnej zgody.
              </span>
            </Callout>

            {d.detailError && !d.detail ? (
              <Callout tone="warn">
                <span>Nie udało się pobrać pełnej treści. Otwórz ogłoszenie w Bazie.</span>
              </Callout>
            ) : null}

            <section className="stack" style={{ gap: 8 }}>
              <h4 className="section-title" style={{ margin: 0 }}>
                Przedmiot zamówienia
              </h4>
              {desc ? (
                <>
                  <div className={`job-description${full ? "" : " is-clipped"}`}>{desc}</div>
                  {desc.length > 900 ? (
                    <button type="button" className="link-button small" onClick={() => setFull((x) => !x)}>
                      {full ? "Pokaż mniej" : "Pokaż całość"}
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="small muted">Brak opisu. Otwórz ogłoszenie w Bazie.</p>
              )}
            </section>

            {d.detail?.conditions.length ? (
              <section className="stack" style={{ gap: 8 }}>
                <h4 className="section-title" style={{ margin: 0 }}>
                  Warunki udziału
                </h4>
                <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                  {d.detail.conditions.map((c) => (
                    <li key={c} style={{ marginBottom: 6 }}>
                      {c}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {d.detail?.criteria.length ? (
              <section className="stack" style={{ gap: 8 }}>
                <h4 className="section-title" style={{ margin: 0 }}>
                  Jak oceniają oferty
                </h4>
                <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                  {d.detail.criteria.map((c) => (
                    <li key={c} style={{ marginBottom: 6 }}>
                      {c}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {d.detail?.attachments.length ? (
              <section className="stack" style={{ gap: 8 }}>
                <h4 className="section-title" style={{ margin: 0 }}>
                  Załączniki ({d.detail.attachments.length})
                </h4>
                <p className="small secondary" style={{ margin: 0 }}>
                  {d.detail.attachments.join(" · ")}
                </p>
                <p className="xsmall muted" style={{ margin: 0 }}>
                  Pobierzesz je w ogłoszeniu w Bazie.
                </p>
              </section>
            ) : null}

            <section className="stack" style={{ gap: 8 }}>
              <h4 className="section-title" style={{ margin: 0 }}>
                Twoja notatka
                <span className="xsmall muted" aria-live="polite" style={{ fontWeight: 400 }}>
                  {noteState === "pending" ? "Zapisywanie…" : note ? "Zapisano" : ""}
                </span>
              </h4>
              <textarea
                className="textarea"
                rows={3}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  noteRef.current = e.target.value;
                  setNoteState("pending");
                  if (noteTimer.current) clearTimeout(noteTimer.current);
                  noteTimer.current = setTimeout(() => void saveNote(), 700);
                }}
                placeholder="np. cena, pytania do zamawiającego, kto przygotowuje dokumenty…"
              />
            </section>

            <div className="btn-group">
              {d.status !== "dismissed" ? (
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => status("dismissed", "Ukryto zapytanie")}
                >
                  <EyeOff size={13} /> Nie interesuje mnie
                </button>
              ) : null}
            </div>
            <p className="xsmall muted">
              Źródło: {d.sourceLine}
              {d.detailFetchedAt ? `, pobrano ${formatWarsaw(d.detailFetchedAt, "d.MM.yyyy, HH:mm")}` : ""}.
              Treść skopiowana bez zmian; ocena dopasowania wyliczona w aplikacji.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
