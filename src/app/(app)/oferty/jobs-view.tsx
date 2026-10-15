"use client";

import {
  Bell,
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  ExternalLink,
  EyeOff,
  FileText,
  Heart,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/components/toast";
import { Callout, Dialog, Empty } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { FAMILY_LABEL, LANGUAGE_LABEL, type RoleFamily } from "@/lib/jobs/match";
import { formatWarsaw } from "@/lib/time";
import type { JobDetail, JobList } from "@/server/careers/service";
import { TailorDialog } from "./tailor-dialog";

type View = "best" | "new" | "favourites" | "saved" | "applied" | "all";
const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "best", label: "Najlepsze", hint: "Najlepiej dopasowane, otwarte oferty" },
  { id: "new", label: "Nowe", hint: "Znalezione w ostatnich 3 dniach" },
  { id: "favourites", label: "Ulubione firmy", hint: "Wszystkie oferty z firm oznaczonych serduszkiem" },
  { id: "saved", label: "Zapisane", hint: "Oferty zapisane na później" },
  { id: "applied", label: "Zaaplikowane", hint: "Oferty, na które wysłano CV" },
  { id: "all", label: "Wszystkie", hint: "Wszystkie otwarte oferty powyżej progu zapisu" },
];

const LOCATION_LABEL: Record<string, string> = {
  warsaw: "Warszawa (biuro / hybrydowo)",
  remote_poland: "Zdalnie z Polski",
  eu_relocation: "Inny kraj UE (przeprowadzka)",
  poland_other: "Inne miasta w Polsce",
};
const WORK_LABEL: Record<string, string> = {
  full_time: "Etat",
  freelance: "Freelance / B2B",
  part_time: "Część etatu",
};
const LANGS = ["en", "pl", "de", "fr", "es", "uk", "ru"];

type Row = JobList["rows"][number];

function ago(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "dziś";
  if (days === 1) return "wczoraj";
  if (days < 30) return `${days} dni temu`;
  return formatWarsaw(iso, "d LLL yyyy");
}

export function ScoreRing({ score, size = 54 }: { score: number; size?: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const tone = score >= 70 ? "#17b67d" : score >= 50 ? "#3b9eff" : "#a3a9b4";
  return (
    <span className="score-ring" style={{ width: size, height: size }} title={`Dopasowanie ${score}%`}>
      <svg viewBox="0 0 54 54" aria-hidden="true">
        <circle cx="27" cy="27" r={r} fill="none" stroke="#eef1f5" strokeWidth="5" />
        <circle
          cx="27"
          cy="27"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(c * score) / 100} ${c}`}
          transform="rotate(-90 27 27)"
        />
      </svg>
      <span>{score}</span>
    </span>
  );
}

export function CompanyMark({ name }: { name: string }) {
  const hues = [152, 200, 260, 330, 30, 175];
  const h = hues[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % hues.length];
  return (
    <span
      className="company-mark"
      style={{ background: `hsl(${h} 70% 95%)`, color: `hsl(${h} 55% 32%)` }}
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function JobsView() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<View>((params.get("view") as View) || "best");
  const [q, setQ] = useState("");
  const [data, setData] = useState<JobList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(params.get("o"));
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const qRef = useRef(q);
  qRef.current = q;

  const load = useCallback(async () => {
    try {
      const u = new URLSearchParams({ view });
      if (qRef.current.trim()) u.set("q", qRef.current.trim());
      setData(await apiFetch<JobList>(`/api/jobs?${u}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nie udało się wczytać ofert");
    }
  }, [view]);

  // Reload (debounced) when the search text changes.
  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  function open(id: string | null) {
    setOpenId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("o", id);
    else url.searchParams.delete("o");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }

  async function loadMore() {
    if (!data) return;
    setMore(true);
    try {
      const u = new URLSearchParams({ view, offset: String(data.rows.length) });
      if (qRef.current.trim()) u.set("q", qRef.current.trim());
      const next = await apiFetch<JobList>(`/api/jobs?${u}`);
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
    setSyncing("Sprawdzam oferty…");
    try {
      for (let i = 0; i < 3; i++) {
        const r = await apiFetch<{
          busy: boolean;
          remainingFetch?: number;
          remainingDetect?: number;
          sources?: unknown[];
        }>("/api/jobs/sync", { body: {} });
        if (r.busy) {
          toast("Aplikacja właśnie sprawdza oferty w tle. Spróbuj za chwilę.");
          break;
        }
        await load();
        const left = (r.remainingFetch ?? 0) + (r.remainingDetect ?? 0);
        if (!left) break;
        setSyncing(`Sprawdzam oferty… (zostało ${left})`);
      }
      toast("Oferty zaktualizowane");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie udało się odświeżyć", "error");
    } finally {
      setSyncing(null);
    }
  }

  if (error) return <Callout tone="bad">{error}</Callout>;

  const counts = data?.counts ?? {};
  return (
    <div className="stack-lg">
      <HeaderActions>
        <div className="btn-group">
          <button type="button" className="btn" onClick={() => setAddOpen(true)}>
            <Plus size={15} /> Dodaj ofertę
          </button>
          <button type="button" className="btn" onClick={() => setPrefsOpen(true)}>
            <SlidersHorizontal size={15} /> Czego szukam
          </button>
        </div>
      </HeaderActions>

      {data && !data.cv.filename ? <CvCard onDone={load} /> : null}

      <section className="stat-cards" aria-label="Podsumowanie">
        <button type="button" className="stat-card" onClick={() => setView("best")}>
          <span className="metric-icon">
            <Sparkles size={24} strokeWidth={1.8} />
          </span>
          <span className="metric-value">{counts.best ?? "–"}</span>
          <span className="metric-label">Najlepsze dopasowania</span>
        </button>
        <button type="button" className="stat-card" onClick={() => setView("new")}>
          <span className="metric-icon">
            <Bell size={22} strokeWidth={1.8} />
          </span>
          <span className="metric-value">{counts.new ?? "–"}</span>
          <span className="metric-label">Nowe w ostatnich 3 dniach</span>
        </button>
        <button type="button" className="stat-card" onClick={() => setView("applied")}>
          <span className="metric-icon">
            <Send size={22} strokeWidth={1.8} />
          </span>
          <span className="metric-value">{counts.applied ?? "–"}</span>
          <span className="metric-label">Zaaplikowane</span>
        </button>
      </section>

      <div className="stack" style={{ gap: 12 }}>
        <div className="views" role="toolbar" aria-label="Widoki ofert">
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
              placeholder="Szukaj stanowiska, firmy, miasta…"
              aria-label="Szukaj ofert"
            />
          </label>
          <div className="toolbar-spacer" />
          <span className="small muted hide-mobile">
            {data?.sync.lastSyncAt
              ? `Sprawdzone ${formatWarsaw(data.sync.lastSyncAt, "d LLL, HH:mm")}`
              : "Jeszcze nie sprawdzano"}
          </span>
          <button type="button" className="btn btn-sm" onClick={syncNow} disabled={syncing !== null}>
            {syncing ? <span className="spinner" /> : <RefreshCw size={14} />} {syncing ?? "Odśwież teraz"}
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
            icon={<Sparkles size={22} />}
            title={view === "best" ? "Jeszcze nie ma dopasowanych ofert" : "Pusto"}
          >
            {view === "best"
              ? "Aplikacja sprawdza oferty co kilka godzin. Kliknij „Odśwież teraz”, wgraj CV albo zmień „Czego szukam”."
              : "Nic tu jeszcze nie ma."}
          </Empty>
        </div>
      ) : (
        <div className="job-grid">
          {data.rows.map((r) => (
            <JobCard key={r.id} r={r} onOpen={() => open(r.id)} active={openId === r.id} />
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
          Źródła: kariery {data.sync.boards} firm z Twojej bazy (sprawdzono {data.sync.companiesChecked} z{" "}
          {data.sync.companiesTotal} stron) i portale z ofertami ({data.sync.feeds}):{" "}
          <a href="https://himalayas.app/" target="_blank" rel="noopener noreferrer">
            Himalayas
          </a>
          ,{" "}
          <a href="https://www.arbeitnow.com/" target="_blank" rel="noopener noreferrer">
            Arbeitnow
          </a>
          . Wynik dopasowania to prosty rachunek ze słów w ogłoszeniu, Twojego CV i miejsca pracy — nie ocena
          AI.
        </p>
      ) : null}

      {openId ? <JobPanel id={openId} onClose={() => open(null)} onChanged={load} /> : null}
      <PrefsDialog open={prefsOpen} data={data} onClose={() => setPrefsOpen(false)} onSaved={load} />
      <AddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={async (id) => {
          setAddOpen(false);
          await load();
          open(id);
        }}
      />
    </div>
  );
}

function HeaderActions({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("jobs-actions")), []);
  return host ? createPortal(children, host) : null;
}

function JobCard({ r, onOpen, active }: { r: Row; onOpen: () => void; active: boolean }) {
  const reasons = r.match.reasons.slice(0, 3);
  return (
    <button type="button" className={`job-card${active ? " is-active" : ""}`} onClick={onOpen}>
      <div className="job-card-top">
        <CompanyMark name={r.companyName} />
        <div className="job-card-head">
          <span className="job-title">{r.title}</span>
          <span className="job-meta">
            {r.companyName}
            {r.favourite ? <Heart size={12} className="heart-on" aria-label="Ulubiona firma" /> : null}
            {r.location ? (
              <>
                {" · "}
                <MapPin size={12} /> {r.location}
              </>
            ) : null}
          </span>
        </div>
        <ScoreRing score={r.score} />
      </div>
      <div className="job-reasons">
        {reasons.map((x) => (
          <span key={x.text} className={`reason reason-${x.tone}`}>
            {x.text}
          </span>
        ))}
      </div>
      <div className="job-card-foot">
        <span>
          {r.postedAt ? `Opublikowano ${ago(r.postedAt)}` : `Znaleziono ${ago(r.firstSeenAt)}`} · {r.source}
        </span>
        {r.status === "saved" ? (
          <span className="tag tag-accent">Zapisana</span>
        ) : r.status === "applied" ? (
          <span className="tag tag-ok">Zaaplikowano</span>
        ) : r.closedAt ? (
          <span className="tag">Zamknięta</span>
        ) : null}
      </div>
    </button>
  );
}

function JobPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<JobDetail | null>(null);
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState<"saved" | "pending">("saved");
  const [full, setFull] = useState(false);
  const [tailor, setTailor] = useState(false);
  const tailored = useCallback((at: string | null) => setD((x) => (x ? { ...x, tailoredCvAt: at } : x)), []);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef("");
  const saveNote = useCallback(async () => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = null;
    await apiFetch(`/api/jobs/${id}`, { method: "PATCH", body: { note: noteRef.current } }).catch(() =>
      toast("Nie zapisano notatki", "error"),
    );
    setNoteState("saved");
  }, [id, toast]);
  // Closing the panel (also with Esc) saves a note that is still waiting.
  useEffect(
    () => () => {
      if (noteTimer.current) void saveNote();
    },
    [saveNote],
  );
  const load = useCallback(async () => {
    const x = await apiFetch<JobDetail>(`/api/jobs/${id}`);
    setD(x);
    setNote(x.note ?? "");
    noteRef.current = x.note ?? "";
  }, [id]);
  useEffect(() => {
    setD(null);
    setFull(false);
    setTailor(false);
    void load().catch(() => toast("Nie udało się wczytać oferty", "error"));
  }, [load, toast]);

  async function status(s: "new" | "saved" | "applied" | "dismissed", msg: string) {
    await apiFetch(`/api/jobs/${id}`, { method: "PATCH", body: { status: s } });
    toast(msg);
    await load();
    onChanged();
    if (s === "dismissed") onClose();
  }
  async function favourite() {
    if (!d?.company) return;
    await apiFetch(`/api/companies/${d.company.id}/favourite`, { body: { favourite: !d.company.favourite } });
    toast(
      d.company.favourite
        ? "Usunięto z ulubionych"
        : "Dodano do ulubionych — pokażemy wszystkie jej oferty w UE",
    );
    await load();
    onChanged();
  }
  async function prompt() {
    const r = await apiFetch<{ prompt: string }>(`/api/jobs/${id}/prompt`, { body: {} });
    await navigator.clipboard.writeText(r.prompt);
    toast("Skopiowano. Wklej w ChatGPT lub Claude — dostaniesz ocenę i szkic listu.");
  }

  const desc = d?.description ?? "";
  return (
    <aside className="panel" aria-label="Oferta pracy" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="panel-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {d ? (
            <>
              <div className="panel-title">{d.title}</div>
              <div className="secondary small" style={{ marginTop: 4 }}>
                {d.companyName}
                {d.location ? ` · ${d.location}` : ""}
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
        {!d ? (
          <div className="stack">
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
                  {d.match.reasons.map((x) => (
                    <span key={x.text} className={`reason reason-${x.tone}`}>
                      {x.text}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="btn-group">
              <a className="btn btn-primary" href={d.url} target="_blank" rel="noopener noreferrer">
                Aplikuj <ExternalLink size={14} />
              </a>
              <button type="button" className="btn" onClick={() => setTailor(true)}>
                <FileText size={14} /> {d.tailoredCvAt ? "CV dla tej oferty" : "Dopasuj CV"}
              </button>
              {d.status === "applied" ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => status("new", "Cofnięto — oferta wróciła na listę")}
                >
                  <Check size={14} /> Zaaplikowano
                </button>
              ) : (
                <button
                  type="button"
                  className="btn"
                  onClick={() => status("applied", "Oznaczono: CV wysłane")}
                >
                  <Send size={14} /> CV wysłane
                </button>
              )}
              {d.status === "saved" ? (
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => status("new", "Usunięto z zapisanych")}
                >
                  <BookmarkCheck size={14} /> Zapisana
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
              <dt>Firma</dt>
              <dd>
                {d.companyName}{" "}
                {d.company ? (
                  <button type="button" className="link-button small" onClick={favourite}>
                    <Heart size={12} className={d.company.favourite ? "heart-on" : ""} />{" "}
                    {d.company.favourite ? "Ulubiona" : "Dodaj do ulubionych"}
                  </button>
                ) : null}
              </dd>
              {d.location ? (
                <>
                  <dt>Miejsce</dt>
                  <dd>
                    {d.location}
                    {d.workplace !== "unknown"
                      ? ` · ${{ remote: "zdalnie", hybrid: "hybrydowo", onsite: "w biurze" }[d.workplace] ?? ""}`
                      : ""}
                  </dd>
                </>
              ) : null}
              {d.employmentType ? (
                <>
                  <dt>Forma</dt>
                  <dd>{d.employmentType}</dd>
                </>
              ) : null}
              {d.department ? (
                <>
                  <dt>Dział</dt>
                  <dd>{d.department}</dd>
                </>
              ) : null}
              <dt>Data</dt>
              <dd>
                {d.postedAt ? `opublikowano ${formatWarsaw(d.postedAt, "d LLL yyyy")}` : ""}
                {d.postedAt ? " · " : ""}znaleziono {formatWarsaw(d.firstSeenAt, "d LLL yyyy")}
              </dd>
              <dt>Źródło</dt>
              <dd>
                {d.sourceUrl ? (
                  <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {d.source}
                  </a>
                ) : (
                  d.source
                )}
              </dd>
            </dl>

            {d.company?.contacts ? (
              <Callout tone="info">
                <span>
                  W Kontaktach masz {d.company.contacts}{" "}
                  {d.company.contacts === 1 ? "osobę lub dział" : "osoby lub działy"} z tej firmy.{" "}
                  <Link href={`/kontakty?view=all&q=${encodeURIComponent(d.companyName)}`}>Zobacz</Link> —
                  możesz napisać do nich wprost.
                </span>
              </Callout>
            ) : null}

            <section className="stack" style={{ gap: 8 }}>
              <h4 className="section-title" style={{ margin: 0 }}>
                Opis stanowiska
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
                <p className="small muted">Źródło nie podaje opisu. Otwórz ofertę przyciskiem „Aplikuj”.</p>
              )}
            </section>

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
                placeholder="np. rozmowa z rekruterką 20.10, wynagrodzenie, kontakt…"
              />
            </section>

            <div className="btn-group">
              <button type="button" className="btn btn-sm" onClick={prompt}>
                <Copy size={13} /> Ocena i szkic listu (ChatGPT / Claude)
              </button>
              {d.status !== "dismissed" ? (
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => status("dismissed", "Ukryto ofertę")}
                >
                  <EyeOff size={13} /> Nie interesuje mnie
                </button>
              ) : null}
            </div>
            <p className="xsmall muted">
              To polecenie zawiera ofertę i Twoje CV — dostaniesz ocenę dopasowania i krótki szkic listu do
              poprawienia. CV dopasujesz przyciskiem „Dopasuj CV” na górze.
            </p>
          </div>
        )}
      </div>
      {d ? (
        <TailorDialog
          id={id}
          title={d.title}
          company={d.companyName}
          open={tailor}
          onClose={() => setTailor(false)}
          onSaved={tailored}
        />
      ) : null}
    </aside>
  );
}

function CvCard({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/cv?name=${encodeURIComponent(file.name)}`, {
        method: "POST",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok)
        throw new Error(
          ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Nie udało się",
        );
      toast("CV wgrane — dopasowania są przeliczone");
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Nie udało się wgrać CV", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card card-pad cv-card">
      <div className="metric-icon" style={{ marginBottom: 0 }}>
        <FileText size={24} strokeWidth={1.8} />
      </div>
      <div className="stack" style={{ gap: 4, flex: 1 }}>
        <h3>Wgraj swoje CV</h3>
        <p className="small secondary">
          Dopasowanie będzie dokładniejsze. Zachowujemy tylko tekst z pliku, w Twojej prywatnej bazie — sam
          plik nie jest przechowywany.
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => input.current?.click()}
        disabled={busy}
      >
        {busy ? <span className="spinner" /> : <Upload size={15} />} Wgraj CV (PDF, DOCX)
      </button>
    </section>
  );
}

function PrefsDialog({
  open,
  data,
  onClose,
  onSaved,
}: {
  open: boolean;
  data: JobList | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [p, setP] = useState<JobList["prefs"] | null>(null);
  const [extra, setExtra] = useState("");
  const [exclude, setExclude] = useState("");
  const [busy, setBusy] = useState(false);
  const cvInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open && data) {
      setP(data.prefs);
      setExtra(data.prefs.extraKeywords.join(", "));
      setExclude(data.prefs.excludeKeywords.join(", "));
    }
  }, [open, data]);
  if (!p || !data) return null;
  const toggle = <K extends "roleFamilies" | "locations" | "languages" | "workTypes">(k: K, v: string) =>
    setP((x) => {
      if (!x) return x;
      const list = x[k] as string[];
      return { ...x, [k]: list.includes(v) ? list.filter((y) => y !== v) : [...list, v] };
    });
  const words = (s: string) =>
    s
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);
  async function save() {
    if (!p) return;
    setBusy(true);
    try {
      await apiFetch("/api/jobs/prefs", {
        method: "PUT",
        body: { ...p, extraKeywords: words(extra), excludeKeywords: words(exclude) },
      });
      toast("Zapisano — dopasowania przeliczone");
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie zapisano", "error");
    } finally {
      setBusy(false);
    }
  }
  async function uploadCv(file: File) {
    const res = await fetch(`/api/jobs/cv?name=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { "content-type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) {
      toast(
        ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Nie udało się wgrać CV",
        "error",
      );
      return;
    }
    toast("CV wgrane");
    onSaved();
    onClose();
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Czego szukam"
      description="Na tej podstawie aplikacja wybiera i układa oferty. Możesz to zmienić w każdej chwili."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Anuluj
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? <span className="spinner" /> : null} Zapisz
          </button>
        </>
      }
    >
      <fieldset className="pref-group">
        <legend>Rodzaj pracy</legend>
        {(Object.keys(FAMILY_LABEL) as RoleFamily[]).map((f) => (
          <label key={f} className="check-row">
            <input
              type="checkbox"
              className="checkbox"
              checked={p.roleFamilies.includes(f)}
              onChange={() => toggle("roleFamilies", f)}
            />
            {FAMILY_LABEL[f]}
          </label>
        ))}
      </fieldset>
      <fieldset className="pref-group">
        <legend>Gdzie</legend>
        {Object.entries(LOCATION_LABEL).map(([k, l]) => (
          <label key={k} className="check-row">
            <input
              type="checkbox"
              className="checkbox"
              checked={p.locations.includes(k as never)}
              onChange={() => toggle("locations", k)}
            />
            {l}
          </label>
        ))}
      </fieldset>
      <fieldset className="pref-group">
        <legend>Forma współpracy</legend>
        {Object.entries(WORK_LABEL).map(([k, l]) => (
          <label key={k} className="check-row">
            <input
              type="checkbox"
              className="checkbox"
              checked={p.workTypes.includes(k as never)}
              onChange={() => toggle("workTypes", k)}
            />
            {l}
          </label>
        ))}
      </fieldset>
      <fieldset className="pref-group">
        <legend>Języki, w których pracujesz</legend>
        {LANGS.map((k) => (
          <label key={k} className="check-row">
            <input
              type="checkbox"
              className="checkbox"
              checked={p.languages.includes(k)}
              onChange={() => toggle("languages", k)}
            />
            {LANGUAGE_LABEL[k]}
          </label>
        ))}
      </fieldset>
      <label className="field">
        <span className="field-label">Dodatkowe słowa, które mnie interesują</span>
        <input
          className="input"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="np. facylitacja, design thinking, wellbeing"
        />
        <span className="field-hint">Oddziel przecinkami. Podnoszą wynik ofert, w których występują.</span>
      </label>
      <label className="field">
        <span className="field-label">Nie pokazuj stanowisk ze słowami</span>
        <input
          className="input"
          value={exclude}
          onChange={(e) => setExclude(e.target.value)}
          placeholder="np. sales, recruiter"
        />
      </label>
      <label className="field">
        <span className="field-label">Pokazuj w „Najlepsze” od {p.showFrom}% dopasowania</span>
        <input
          type="range"
          min={20}
          max={85}
          step={5}
          value={p.showFrom}
          onChange={(e) => setP({ ...p, showFrom: Number(e.target.value) })}
        />
      </label>
      <div className="stack" style={{ gap: 8 }}>
        <span className="field-label">Twoje CV</span>
        {data.cv.filename ? (
          <div className="row wrap" style={{ gap: 10 }}>
            <span className="small">
              <FileText size={13} /> {data.cv.filename} · wgrane{" "}
              {formatWarsaw(data.cv.uploadedAt, "d LLL yyyy")}
            </span>
            <button type="button" className="link-button small" onClick={() => cvInput.current?.click()}>
              Wgraj nowe
            </button>
            <button
              type="button"
              className="link-button small"
              onClick={async () => {
                await apiFetch("/api/jobs/cv", { method: "DELETE" });
                toast("Usunięto CV");
                onSaved();
                onClose();
              }}
            >
              Usuń
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-sm"
            style={{ alignSelf: "flex-start" }}
            onClick={() => cvInput.current?.click()}
          >
            <Upload size={13} /> Wgraj CV
          </button>
        )}
        {p.cvKeywords.length ? (
          <fieldset
            className="filter-chips"
            aria-label="Słowa z CV"
            style={{ border: 0, margin: 0, padding: 0 }}
          >
            {p.cvKeywords.map((w) => (
              <span key={w} className="chip">
                {w}
                <button
                  type="button"
                  aria-label={`Usuń ${w}`}
                  onClick={() => setP({ ...p, cvKeywords: p.cvKeywords.filter((x) => x !== w) })}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </fieldset>
        ) : null}
        <input
          ref={cvInput}
          type="file"
          hidden
          accept=".pdf,.docx,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadCv(f);
            e.target.value = "";
          }}
        />
      </div>
    </Dialog>
  );
}

function AddDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (id: string) => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({ url: "", title: "", companyName: "", location: "", description: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF({ url: "", title: "", companyName: "", location: "", description: "" });
  }, [open]);
  async function add() {
    setBusy(true);
    try {
      const r = await apiFetch<{ id: string }>("/api/jobs", { body: { ...f, location: f.location || null } });
      toast("Dodano ofertę");
      onAdded(r.id);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie dodano", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Dodaj ofertę"
      description="Oferta z LinkedIn, pracuj.pl albo innej strony? Wklej link i treść — policzymy dopasowanie i zapiszemy ją."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Anuluj
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={add}
            disabled={busy || !f.url || !f.title || !f.companyName}
          >
            {busy ? <span className="spinner" /> : null} Dodaj
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">Link do oferty</span>
        <input
          className="input"
          type="url"
          value={f.url}
          onChange={(e) => setF({ ...f, url: e.target.value })}
          placeholder="https://…"
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Stanowisko</span>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">Firma</span>
          <input
            className="input"
            value={f.companyName}
            onChange={(e) => setF({ ...f, companyName: e.target.value })}
          />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Miejsce (opcjonalnie)</span>
        <input
          className="input"
          value={f.location}
          onChange={(e) => setF({ ...f, location: e.target.value })}
          placeholder="np. Warszawa, hybrydowo"
        />
      </label>
      <label className="field">
        <span className="field-label">Treść ogłoszenia (opcjonalnie, ale poprawia dopasowanie)</span>
        <textarea
          className="textarea"
          rows={6}
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
      </label>
    </Dialog>
  );
}
