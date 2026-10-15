"use client";

import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  CalendarPlus,
  Check,
  ExternalLink,
  EyeOff,
  Globe,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Star,
  Users,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/components/toast";
import { Callout, Dialog, Empty } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { formatWarsaw } from "@/lib/time";
import type { EventDetail, EventList } from "@/server/events/service";
import { ScoreRing } from "../oferty/jobs-view";

type View = "best" | "soon" | "warsaw" | "online" | "mine" | "all";
const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "best", label: "Pasujące", hint: "Nadchodzące wydarzenia dla HR i L&D" },
  { id: "soon", label: "Najbliższe 30 dni", hint: "Co dzieje się w najbliższym miesiącu" },
  { id: "warsaw", label: "Warszawa", hint: "Na miejscu w Warszawie" },
  { id: "online", label: "Online", hint: "Webinary i spotkania online" },
  { id: "mine", label: "Moje", hint: "Zapisane i te, na które idziesz" },
  { id: "all", label: "Wszystkie", hint: "Wszystkie nadchodzące" },
];
type Row = EventList["rows"][number];

function when(startsAt: string, endsAt: string | null, allDay: boolean): string {
  const start = formatWarsaw(startsAt, allDay ? "EEEE, d MMMM yyyy" : "EEEE, d MMMM yyyy, HH:mm");
  if (!endsAt) return start;
  const sameDay = formatWarsaw(startsAt, "yyyy-MM-dd") === formatWarsaw(endsAt, "yyyy-MM-dd");
  if (sameDay) return allDay ? start : `${start}–${formatWarsaw(endsAt, "HH:mm")}`;
  return `${start} – ${formatWarsaw(endsAt, allDay ? "d MMMM" : "d MMMM, HH:mm")}`;
}

function DateBadge({ iso }: { iso: string }) {
  return (
    <span className="date-badge" aria-hidden="true">
      <span>{formatWarsaw(iso, "d")}</span>
      <small>{formatWarsaw(iso, "LLL")}</small>
    </span>
  );
}

export function EventsView() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<View>((params.get("view") as View) || "best");
  const [q, setQ] = useState("");
  const [data, setData] = useState<EventList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(params.get("o"));
  const [syncing, setSyncing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const qRef = useRef(q);
  qRef.current = q;

  const load = useCallback(async () => {
    try {
      const u = new URLSearchParams({ view });
      if (qRef.current.trim()) u.set("q", qRef.current.trim());
      setData(await apiFetch<EventList>(`/api/events?${u}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nie udało się wczytać wydarzeń");
    }
  }, [view]);
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

  async function syncNow() {
    setSyncing(true);
    try {
      const r = await apiFetch<{ busy: boolean; added?: number; changedPages?: string[] }>(
        "/api/events/sync",
        {
          body: {},
        },
      );
      if (r.busy) toast("Aplikacja właśnie sprawdza wydarzenia w tle. Spróbuj za chwilę.");
      else
        toast(
          r.added || r.changedPages?.length
            ? `Nowe wydarzenia: ${r.added ?? 0}, zmiany na stronach: ${r.changedPages?.length ?? 0}`
            : "Wydarzenia aktualne",
        );
      await load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie udało się odświeżyć", "error");
    } finally {
      setSyncing(false);
    }
  }

  async function openWatched(key: string) {
    await apiFetch(`/api/events/watch/${encodeURIComponent(key)}`, { body: {} }).catch(() => null);
    await load();
  }

  if (error) return <Callout tone="bad">{error}</Callout>;
  const counts = data?.counts ?? {};
  return (
    <div className="stack-lg">
      <HeaderActions>
        <button type="button" className="btn" onClick={() => setAddOpen(true)}>
          <Plus size={15} /> Dodaj wydarzenie
        </button>
      </HeaderActions>

      <section className="stat-cards" aria-label="Podsumowanie">
        <button type="button" className="stat-card" onClick={() => setView("best")}>
          <span className="metric-icon">
            <CalendarDays size={22} strokeWidth={1.8} />
          </span>
          <span className="metric-value">{counts.best ?? "–"}</span>
          <span className="metric-label">Pasujące, nadchodzące</span>
        </button>
        <button type="button" className="stat-card" onClick={() => setView("warsaw")}>
          <span className="metric-icon">
            <MapPin size={22} strokeWidth={1.8} />
          </span>
          <span className="metric-value">{counts.warsaw ?? "–"}</span>
          <span className="metric-label">W Warszawie</span>
        </button>
        <button type="button" className="stat-card" onClick={() => setView("mine")}>
          <span className="metric-icon">
            <Star size={22} strokeWidth={1.8} />
          </span>
          <span className="metric-value">{counts.mine ?? "–"}</span>
          <span className="metric-label">Zapisane i „Idę”</span>
        </button>
      </section>

      <div className="stack" style={{ gap: 12 }}>
        <div className="views" role="toolbar" aria-label="Widoki wydarzeń">
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
              placeholder="Szukaj nazwy, organizatora, miasta…"
              aria-label="Szukaj wydarzeń"
            />
          </label>
          <div className="toolbar-spacer" />
          <span className="small muted hide-mobile">
            {data?.lastSyncAt
              ? `Sprawdzone ${formatWarsaw(data.lastSyncAt, "d LLL, HH:mm")}`
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
          <Empty icon={<CalendarDays size={22} />} title="Pusto">
            {view === "mine"
              ? "Zapisz wydarzenie albo oznacz „Idę”, a pojawi się tutaj."
              : "Aplikacja sprawdza kalendarze raz dziennie. Kliknij „Odśwież teraz” albo dodaj wydarzenie ręcznie."}
          </Empty>
        </div>
      ) : (
        <div className="job-grid">
          {data.rows.map((r) => (
            <EventCard key={r.id} r={r} onOpen={() => open(r.id)} active={openId === r.id} />
          ))}
        </div>
      )}

      {data ? (
        <section className="card stack" aria-labelledby="watched-title">
          <div>
            <h2 id="watched-title" className="section-title" style={{ margin: 0 }}>
              Konferencje i kalendarze, które obserwujemy
            </h2>
            <p className="small secondary" style={{ margin: "4px 0 0" }}>
              Te strony nie publikują listy wydarzeń dla programów, więc aplikacja codziennie sprawdza, czy
              pojawiły się na nich nowe daty, i pokazuje te linijki.
            </p>
          </div>
          <ul className="watch-list">
            {data.watched.map((w) => (
              <li key={w.key} className={w.isNew ? "is-new" : undefined}>
                <div className="watch-head">
                  <a
                    href={w.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void openWatched(w.key)}
                  >
                    {w.name} <ExternalLink size={12} />
                  </a>
                  {w.isNew ? <span className="tag tag-accent">Nowe na stronie</span> : null}
                </div>
                <span className="xsmall muted">
                  {w.note ? `${w.note} · ` : ""}
                  {w.error
                    ? "nie udało się sprawdzić"
                    : w.checkedAt
                      ? `sprawdzono ${formatWarsaw(w.checkedAt, "d LLL")}`
                      : "jeszcze nie sprawdzano"}
                </span>
                {w.isNew && w.newLines.length ? (
                  <ul className="watch-lines">
                    {w.newLines.slice(0, 4).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data ? (
        <section className="card stack" aria-labelledby="ways-title">
          <div>
            <h2 id="ways-title" className="section-title" style={{ margin: 0 }}>
              Inne sposoby, żeby poznać osoby od szkoleń
            </h2>
            <p className="small secondary" style={{ margin: "4px 0 0" }}>
              Członkostwo, występy i strefy wystawców. Sprawdzone 15.10.2026; szczegóły mogą się zmienić.
            </p>
          </div>
          <ul className="watch-list">
            {data.ways.map((w) => (
              <li key={w.name}>
                <div className="watch-head">
                  <a href={w.url} target="_blank" rel="noopener noreferrer">
                    {w.name} <ExternalLink size={12} />
                  </a>
                </div>
                <span className="small secondary">{w.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data ? (
        <p className="xsmall muted">
          Wydarzenia pochodzą z kalendarzy publikowanych dla wyszukiwarek i aplikacji kalendarzowych:{" "}
          {data.feeds.map((f, i) => (
            <span key={f.url}>
              {i ? ", " : ""}
              <a href={f.url} target="_blank" rel="noopener noreferrer">
                {f.name}
              </a>
            </span>
          ))}
          . Daty i miejsca potwierdzaj u organizatora. Ocena dopasowania to prosty rachunek ze słów — nie
          ocena AI.
        </p>
      ) : null}

      {openId ? <EventPanel id={openId} onClose={() => open(null)} onChanged={load} /> : null}
      <AddEventDialog
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
  useEffect(() => setHost(document.getElementById("events-actions")), []);
  return host ? createPortal(children, host) : null;
}

function EventCard({ r, onOpen, active }: { r: Row; onOpen: () => void; active: boolean }) {
  return (
    <button type="button" className={`job-card${active ? " is-active" : ""}`} onClick={onOpen}>
      <div className="job-card-top">
        <DateBadge iso={r.startsAt} />
        <div className="job-card-head">
          <span className="job-title">{r.title}</span>
          <span className="job-meta">
            {r.organiser ? `${r.organiser} · ` : ""}
            {r.online && !r.place ? (
              <>
                <Globe size={12} /> online
              </>
            ) : r.place ? (
              <>
                <MapPin size={12} /> {r.place}
              </>
            ) : (
              "miejsce w opisie"
            )}
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
        <span>
          {r.allDay ? formatWarsaw(r.startsAt, "EEEE") : formatWarsaw(r.startsAt, "EEEE, HH:mm")}
          {r.price ? ` · ${r.price}` : ""} · {r.sourceName}
        </span>
        {r.status === "going" ? (
          <span className="tag tag-ok">Idę</span>
        ) : r.status === "saved" ? (
          <span className="tag tag-accent">Zapisane</span>
        ) : null}
      </div>
    </button>
  );
}

function EventPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<EventDetail | null>(null);
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState<"saved" | "pending">("saved");
  const [full, setFull] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef("");
  const saveNote = useCallback(async () => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = null;
    await apiFetch(`/api/events/${id}`, { method: "PATCH", body: { note: noteRef.current } }).catch(() =>
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
    const x = await apiFetch<EventDetail>(`/api/events/${id}`);
    setD(x);
    setNote(x.note ?? "");
    noteRef.current = x.note ?? "";
  }, [id]);
  useEffect(() => {
    setD(null);
    setFull(false);
    void load().catch(() => toast("Nie udało się wczytać wydarzenia", "error"));
  }, [load, toast]);

  async function status(s: "new" | "saved" | "going" | "dismissed", msg: string) {
    await apiFetch(`/api/events/${id}`, { method: "PATCH", body: { status: s } });
    toast(msg);
    await load();
    onChanged();
    if (s === "dismissed") onClose();
  }

  return (
    <aside className="panel" aria-label="Wydarzenie" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="panel-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {d ? (
            <>
              <div className="panel-title">{d.title}</div>
              <div className="secondary small" style={{ marginTop: 4 }}>
                {d.organiser ? `${d.organiser} · ` : ""}
                {formatWarsaw(d.startsAt, "d MMMM yyyy")}
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
                Strona wydarzenia <ExternalLink size={14} />
              </a>
              {d.status === "going" ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => status("saved", "Zmieniono na „Zapisane”")}
                >
                  <Check size={14} /> Idę
                </button>
              ) : (
                <button type="button" className="btn" onClick={() => status("going", "Oznaczono: idę")}>
                  <Users size={14} /> Idę
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
              ) : d.status !== "going" ? (
                <button type="button" className="btn btn-quiet" onClick={() => status("saved", "Zapisano")}>
                  <Bookmark size={14} /> Zapisz
                </button>
              ) : null}
              <a className="btn btn-quiet" href={`/api/events/${d.id}/ics`}>
                <CalendarPlus size={14} /> Do kalendarza
              </a>
            </div>

            <dl className="kv">
              <dt>Kiedy</dt>
              <dd>{when(d.startsAt, d.endsAt, d.allDay)}</dd>
              <dt>Gdzie</dt>
              <dd>{d.place ?? (d.online ? "Online" : "W opisie wydarzenia")}</dd>
              {d.price ? (
                <>
                  <dt>Cena</dt>
                  <dd>{d.price}</dd>
                </>
              ) : null}
              <dt>Źródło</dt>
              <dd>
                {d.sourceUrl ? (
                  <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {d.sourceName}
                  </a>
                ) : (
                  d.sourceName
                )}
              </dd>
            </dl>

            <Callout tone="info">
              <span>
                Na miejscu rozmawiaj i pytaj, czy możesz wysłać ofertę. Gdy ktoś się zgodzi, zapisz to w jego
                kontakcie (data i nazwa wydarzenia): wtedy aplikacja pozwoli wysłać maila.
              </span>
            </Callout>

            {d.description ? (
              <section className="stack" style={{ gap: 8 }}>
                <h4 className="section-title" style={{ margin: 0 }}>
                  Opis
                </h4>
                <div className={`job-description${full ? "" : " is-clipped"}`}>{d.description}</div>
                {d.description.length > 900 ? (
                  <button type="button" className="link-button small" onClick={() => setFull((x) => !x)}>
                    {full ? "Pokaż mniej" : "Pokaż całość"}
                  </button>
                ) : null}
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
                placeholder="np. kogo chcesz poznać, o czym była rozmowa, co obiecać po spotkaniu…"
              />
            </section>

            {d.status !== "dismissed" ? (
              <div className="btn-group">
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => status("dismissed", "Ukryto wydarzenie")}
                >
                  <EyeOff size={13} /> Nie interesuje mnie
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}

function AddEventDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (id: string) => void;
}) {
  const toast = useToast();
  const empty = { url: "", title: "", date: "", time: "", place: "", online: false, organiser: "" };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF({ url: "", title: "", date: "", time: "", place: "", online: false, organiser: "" });
  }, [open]);
  async function add() {
    setBusy(true);
    try {
      const r = await apiFetch<{ id: string }>("/api/events", {
        body: { ...f, time: f.time || null, place: f.place || null, organiser: f.organiser || null },
      });
      toast("Dodano wydarzenie");
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
      title="Dodaj wydarzenie"
      description="Znalezione na LinkedIn, w newsletterze albo od znajomych? Zapisz je tutaj, żeby mieć wszystko w jednym miejscu."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Anuluj
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={add}
            disabled={busy || !f.url || !f.title || !f.date}
          >
            {busy ? <span className="spinner" /> : null} Dodaj
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">Link do wydarzenia</span>
        <input
          className="input"
          type="url"
          value={f.url}
          onChange={(e) => setF({ ...f, url: e.target.value })}
          placeholder="https://…"
        />
      </label>
      <label className="field">
        <span className="field-label">Nazwa</span>
        <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Data</span>
          <input
            className="input"
            type="date"
            value={f.date}
            onChange={(e) => setF({ ...f, date: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field-label">Godzina (opcjonalnie)</span>
          <input
            className="input"
            type="time"
            value={f.time}
            onChange={(e) => setF({ ...f, time: e.target.value })}
          />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Miejsce</span>
          <input
            className="input"
            value={f.place}
            onChange={(e) => setF({ ...f, place: e.target.value })}
            placeholder="np. Warszawa, Mysia 3"
          />
        </label>
        <label className="field">
          <span className="field-label">Organizator</span>
          <input
            className="input"
            value={f.organiser}
            onChange={(e) => setF({ ...f, organiser: e.target.value })}
          />
        </label>
      </div>
      <label className="row small" style={{ gap: 8 }}>
        <input
          type="checkbox"
          checked={f.online}
          onChange={(e) => setF({ ...f, online: e.target.checked })}
        />{" "}
        Online
      </label>
    </Dialog>
  );
}
