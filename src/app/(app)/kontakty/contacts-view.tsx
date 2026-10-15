"use client";

import { ArrowDown, ArrowUp, Download, Filter, Search, Users, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ContactPanel } from "@/components/contact-panel";
import { useToast } from "@/components/toast";
import { Callout, EmailStatusLabel, Empty, OutreachLabel, SkeletonRows, useDismiss } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import {
  BUILTIN_VIEWS,
  CONTACT_KINDS,
  type ContactQuery,
  DEFAULT_VIEW,
  EMAIL_STATUSES,
  KIND_LABEL,
  OUTREACH,
  QUALITIES,
  queryToSearch,
  ROLE_CATEGORIES,
  ROLE_FUNCTIONS,
  ROLE_LABEL,
  SECTOR_LABEL,
  SIZE_BANDS,
  SIZE_LABEL,
} from "@/lib/contact-query";
import { EMAIL_STATUS_LABEL, OUTREACH_LABEL, QUALITY_LABEL } from "@/lib/contact-rules";
import { FUNCTION_LABEL } from "@/lib/roles";
import type { ContactListRow } from "@/server/services/contact-list";
import { AddContactDialog, ImportDialog } from "./contact-dialogs";

type ListResponse = {
  rows: ContactListRow[];
  total: number;
  offset: number;
  limit: number;
  counts: Record<string, number> | null;
};
type CustomView = { id: string; name: string; query: Partial<ContactQuery> };

const PAGE = 100;
const FILTER_KEYS = [
  "q",
  "withEmail",
  "sector",
  "size",
  "role",
  "dept",
  "kind",
  "quality",
  "email",
  "outreach",
  "review",
  "verifiedOlderThan",
  "fallback",
  "companyId",
  "sort",
  "dir",
] as const;

const SORT_OPTIONS: { value: NonNullable<ContactQuery["sort"]>; label: string }[] = [
  { value: "reach", label: "Najlepsze na górze" },
  { value: "quality", label: "Jakość danych" },
  { value: "company", label: "Firma" },
  { value: "name", label: "Osoba / dział" },
  { value: "role", label: "Rola" },
  { value: "verification", label: "Weryfikacja" },
  { value: "last_contact", label: "Ostatni kontakt" },
  { value: "reply", label: "Odpowiedź" },
  { value: "discovered", label: "Data odkrycia" },
];

function parseSearch(sp: URLSearchParams): Partial<ContactQuery> & { view?: string } {
  const out: Record<string, unknown> = {};
  for (const [k, v] of sp.entries()) {
    if (k === "c") continue;
    if (["sector", "size", "role", "dept", "kind", "quality", "email", "outreach", "review"].includes(k))
      out[k] = v ? v.split(",") : [];
    else out[k] = v;
  }
  return out as Partial<ContactQuery>;
}

export function ContactsView({
  attention,
}: {
  attention: { tone: "warn" | "bad" | "info"; text: string; href: string } | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const urlQuery = useMemo(() => parseSearch(new URLSearchParams(sp.toString())), [sp]);
  const view =
    (urlQuery.view as string | undefined) ?? (Object.keys(urlQuery).length === 0 ? DEFAULT_VIEW : undefined);
  const [rows, setRows] = useState<ContactListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panelId, setPanelId] = useState<string | null>(sp.get("c"));
  const [customViews, setCustomViews] = useState<CustomView[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dialog, setDialog] = useState<"import" | "add" | null>(null);
  const [search, setSearch] = useState(urlQuery.q ?? "");
  const searchRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableSectionElement>(null);
  const reqId = useRef(0);

  const effectiveQuery: Partial<ContactQuery> = useMemo(() => ({ ...urlQuery, view }), [urlQuery, view]);
  const queryString = queryToSearch(effectiveQuery);

  const setQuery = useCallback(
    (patch: Partial<ContactQuery> & { view?: string }, opts: { resetView?: boolean } = {}) => {
      // Keep the view you are on (also the default one) when adding a filter or a search.
      const next: Record<string, unknown> = {
        ...urlQuery,
        ...(view && !urlQuery.view ? { view } : {}),
        ...patch,
      };
      if (opts.resetView) delete next.view;
      for (const k of Object.keys(next)) {
        const v = next[k];
        if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete next[k];
      }
      const qs = queryToSearch(next as Partial<ContactQuery>);
      const c = panelId ? `${qs ? "&" : ""}c=${panelId}` : "";
      router.replace(`/kontakty${qs || c ? `?${qs}${c}` : ""}`, { scroll: false });
    },
    [urlQuery, view, router, panelId],
  );

  const load = useCallback(
    async (offset = 0) => {
      const id = ++reqId.current;
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const res = await apiFetch<ListResponse>(
          `/api/contacts?${queryString}&offset=${offset}&limit=${PAGE}${offset === 0 ? "&counts=1" : ""}`,
        );
        if (id !== reqId.current) return;
        setRows((prev) => (offset === 0 ? res.rows : [...prev, ...res.rows]));
        setTotal(res.total);
        if (res.counts) setCounts(res.counts);
        if (offset === 0) {
          setActive(0);
          setSelected(new Set());
        }
      } catch (e) {
        if (id !== reqId.current) return;
        setError(e instanceof ApiError ? e.message : "Nie udało się wczytać kontaktów.");
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [queryString],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  useEffect(() => {
    apiFetch<{ views: CustomView[] }>("/api/views")
      .then((r) => setCustomViews(r.views))
      .catch(() => {});
  }, []);

  // Debounced search into the URL.
  useEffect(() => {
    if ((urlQuery.q ?? "") === search) return;
    const t = setTimeout(() => setQuery({ q: search || undefined }), 250);
    return () => clearTimeout(t);
  }, [search, urlQuery.q, setQuery]);

  // Keep ?c= in sync without re-rendering the table (keeps the scroll position).
  const openPanel = useCallback((id: string | null) => {
    setPanelId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("c", id);
    else url.searchParams.delete("c");
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  // Keyboard: / search, j/k or arrows move, Enter opens, x selects, e prepares email, Esc closes panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = target.closest("input, textarea, select, [contenteditable=true], dialog");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing) return;
      if (e.key === "Escape" && panelId) {
        openPanel(null);
        return;
      }
      if (rows.length === 0) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(rows.length - 1, a + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter" || e.key === "o") {
        const r = rows[active];
        if (r) openPanel(r.id);
      } else if (e.key === "x") {
        const r = rows[active];
        if (r) toggle(r.id);
      } else if (e.key === "e") {
        const r = rows[active];
        if (r) router.push(`/wiadomosci/nowa?contact=${r.id}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs only when the keyboard cursor moves
  useEffect(() => {
    const row = tableRef.current?.querySelector<HTMLTableRowElement>(`tr[data-index="${active}"]`);
    row?.scrollIntoView({ block: "nearest" });
    if (panelId && rows[active] && document.activeElement?.closest("tbody")) openPanel(rows[active]!.id);
  }, [active]);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function bulk(action: "accept" | "reject" | "dnc") {
    const ids = [...selected];
    try {
      const r = await apiFetch<{ updated: number }>("/api/contacts/bulk", { body: { action, ids } });
      toast(`Zaktualizowano: ${r.updated}`);
      void load(0);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie udało się", "error");
    }
  }

  async function saveView() {
    const name = window.prompt("Nazwa widoku");
    if (!name) return;
    try {
      const v = await apiFetch<CustomView>("/api/views", {
        body: { name, query: { ...urlQuery, view: undefined } },
      });
      setCustomViews((c) => [...c, v]);
      toast("Zapisano widok");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie udało się zapisać", "error");
    }
  }

  const activeFilters = FILTER_KEYS.filter(
    (k) =>
      k !== "q" &&
      k !== "sort" &&
      k !== "dir" &&
      urlQuery[k] !== undefined &&
      !(Array.isArray(urlQuery[k]) && (urlQuery[k] as unknown[]).length === 0),
  );
  const viewMeta = BUILTIN_VIEWS.find((v) => v.id === view);
  const sort = urlQuery.sort ?? viewMeta?.query.sort ?? "company";
  const dir = urlQuery.dir ?? "asc";
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function headerSort(key: NonNullable<ContactQuery["sort"]>, label: string) {
    const isSorted = sort === key;
    return (
      <th aria-sort={isSorted ? (dir === "asc" ? "ascending" : "descending") : undefined}>
        <button
          type="button"
          onClick={() => setQuery({ sort: key, dir: isSorted && dir === "asc" ? "desc" : "asc" })}
        >
          {label}
          {isSorted ? dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : null}
        </button>
      </th>
    );
  }

  return (
    <>
      <HowItWorks />
      {attention ? (
        <div style={{ marginBottom: 16 }}>
          <Callout tone={attention.tone}>
            <span>
              {attention.text} <Link href={attention.href}>Szczegóły</Link>
            </span>
          </Callout>
        </div>
      ) : null}

      <div className="views" role="toolbar" aria-label="Widoki">
        {BUILTIN_VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            title={v.hint}
            onClick={() => router.replace(`/kontakty?view=${v.id}`, { scroll: false })}
          >
            {v.name}
            {counts[v.id] !== undefined ? <span className="views-count">{counts[v.id]}</span> : null}
          </button>
        ))}
        {customViews.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={false}
            onClick={() => router.replace(`/kontakty?${queryToSearch(v.query)}`, { scroll: false })}
          >
            {v.name}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="search">
          <Search size={15} aria-hidden="true" />
          <input
            ref={searchRef}
            className="input"
            type="search"
            placeholder="Szukaj osoby, firmy, adresu…"
            aria-label="Szukaj kontaktów"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") (e.target as HTMLInputElement).blur();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
                tableRef.current?.querySelector<HTMLTableRowElement>("tr[data-index]")?.focus();
              }
            }}
          />
          <kbd>/</kbd>
        </div>
        <FiltersButton
          open={filtersOpen}
          setOpen={setFiltersOpen}
          query={urlQuery}
          setQuery={(p) => setQuery(p)}
          activeCount={activeFilters.length}
        />
        <label className="row small secondary">
          <span className="hide-mobile">Sortuj</span>
          <select
            className="select"
            style={{ width: 210 }}
            value={sort}
            onChange={(e) => setQuery({ sort: e.target.value as ContactQuery["sort"] })}
            aria-label="Sortowanie"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-quiet btn-sm hide-mobile" onClick={saveView}>
          Zapisz widok
        </button>
      </div>

      {activeFilters.length > 0 ? (
        <div className="filter-chips" style={{ marginBottom: 12 }}>
          {activeFilters.map((k) => (
            <span key={k} className="chip">
              {chipLabel(k, urlQuery[k])}
              <button
                type="button"
                aria-label="Usuń filtr"
                onClick={() => setQuery({ [k]: undefined } as Partial<ContactQuery>)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            className="link-button small"
            onClick={() => router.replace(view ? `/kontakty?view=${view}` : "/kontakty", { scroll: false })}
          >
            Wyczyść filtry
          </button>
        </div>
      ) : null}

      <div
        className="table-wrap"
        style={{ maxHeight: "calc(100vh - 290px)", minHeight: 320 }}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (!loadingMore && rows.length < total && el.scrollTop + el.clientHeight > el.scrollHeight - 400)
            void load(rows.length);
        }}
      >
        <table className="data-table contacts-table" aria-label="Kontakty" aria-rowcount={total}>
          <thead>
            <tr>
              <th className="col-check">
                <input
                  type="checkbox"
                  className="checkbox"
                  aria-label="Zaznacz wszystkie widoczne"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                />
              </th>
              {headerSort("name", "Osoba lub dział")}
              {headerSort("company", "Firma")}
              {headerSort("role", "Dział / rola")}
              <th>E-mail</th>
              {headerSort("verification", "Weryfikacja")}
              {headerSort("last_contact", "Ostatni kontakt")}
              {headerSort("reply", "Status")}
            </tr>
          </thead>
          <tbody ref={tableRef}>
            {loading ? (
              <SkeletonRows cols={8} />
            ) : error ? (
              <tr style={{ cursor: "default" }}>
                <td colSpan={8}>
                  <Empty
                    title="Nie udało się wczytać kontaktów"
                    actions={
                      <button type="button" className="btn" onClick={() => load(0)}>
                        Spróbuj ponownie
                      </button>
                    }
                  >
                    {error}
                  </Empty>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr style={{ cursor: "default" }}>
                <td colSpan={8} style={{ whiteSpace: "normal" }}>
                  <EmptyContacts
                    view={view}
                    filtered={activeFilters.length > 0 || Boolean(urlQuery.q)}
                    onImport={() => setDialog("import")}
                  />
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={r.id}
                  data-index={i}
                  tabIndex={i === active ? 0 : -1}
                  aria-selected={selected.has(r.id)}
                  className={panelId === r.id || (i === active && !panelId) ? "is-active" : undefined}
                  onClick={() => {
                    setActive(i);
                    openPanel(r.id);
                  }}
                  onFocus={(e) => {
                    // Only the row itself; focusing its checkbox must not move the cursor (first click was lost).
                    if (e.target === e.currentTarget) setActive(i);
                  }}
                >
                  <td
                    className="col-check"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="checkbox"
                      aria-label={`Zaznacz ${r.fullName ?? r.departmentLabel ?? r.email}`}
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  </td>
                  <td className="col-main">
                    <div className="cell-stack">
                      <span className="cell-primary ellipsis">
                        {r.reviewStatus === "new" ? (
                          <span
                            className="new-dot"
                            role="img"
                            aria-label="Nowy"
                            title="Nowy — do przejrzenia"
                          />
                        ) : null}
                        {r.fullName ??
                          r.departmentLabel ??
                          (r.kind === "general_inbox"
                            ? "Adres ogólny"
                            : r.kind === "person"
                              ? "Osoba (bez nazwiska)"
                              : "Skrzynka działu")}
                      </span>
                      <span className="cell-sub">
                        {r.title ?? (r.email && r.kind !== "person" ? r.email : KIND_LABEL[r.kind])}
                      </span>
                    </div>
                  </td>
                  <td className="col-company">
                    <div className="cell-stack">
                      <span className="ellipsis">{r.companyBrand ?? r.companyName}</span>
                      <span className="cell-sub">{SECTOR_LABEL[r.companySector] ?? r.companySector}</span>
                    </div>
                  </td>
                  <td className="col-role">
                    <div className="cell-stack">
                      <span className="ellipsis">
                        {r.roleFunction !== "other" ? FUNCTION_LABEL[r.roleFunction] : "Dział nieustalony"}
                      </span>
                      {r.kind === "person" ? (
                        <span className="cell-sub">{ROLE_LABEL[r.roleCategory]}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="col-email">
                    {r.email ? (
                      <div className="cell-stack">
                        <span className="ellipsis">{r.email}</span>
                        {r.emailOrigin === "provider_pattern" ? (
                          <span className="cell-sub">Przewidziany ze wzorca</span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="muted small">Brak adresu</span>
                    )}
                  </td>
                  <td className="col-verify">
                    {r.email ? (
                      <EmailStatusLabel status={r.emailStatus} at={r.emailCheckedAt} />
                    ) : (
                      <span className="muted small">—</span>
                    )}
                  </td>
                  <td className="col-last small secondary tabular">
                    {r.lastContactedAt ? new Date(r.lastContactedAt).toLocaleDateString("pl-PL") : "—"}
                  </td>
                  <td className="col-status" data-status={r.outreachStatus}>
                    <OutreachLabel status={r.outreachStatus} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <span className="tabular">
          {loading ? "Wczytywanie…" : `${rows.length} z ${total}`}
          {viewMeta ? <span className="hide-mobile"> · {viewMeta.hint}</span> : null}
        </span>
        <span className="hide-mobile">
          <kbd>↑</kbd> <kbd>↓</kbd> wybór · <kbd>↵</kbd> otwórz · <kbd>x</kbd> zaznacz · <kbd>e</kbd> email ·{" "}
          <kbd>/</kbd> szukaj
        </span>
      </div>

      {selected.size > 0 ? (
        <div className="bulkbar" role="toolbar" aria-label="Działania na zaznaczonych">
          <span className="tabular">Zaznaczono {selected.size}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => router.push(`/wiadomosci/nowa?contacts=${[...selected].join(",")}`)}
          >
            Przygotuj szkice
          </button>
          <button type="button" className="btn btn-sm" onClick={() => bulk("accept")}>
            Zaakceptuj
          </button>
          <button type="button" className="btn btn-sm" onClick={() => bulk("reject")}>
            Odrzuć
          </button>
          <button type="button" className="btn btn-sm" onClick={() => bulk("dnc")}>
            Nie kontaktować
          </button>
          <a className="btn btn-sm" href={`/api/contacts/export?${queryString}`}>
            Eksportuj widok
          </a>
          <button
            type="button"
            className="btn btn-sm btn-icon"
            aria-label="Wyczyść zaznaczenie"
            onClick={() => setSelected(new Set())}
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      {panelId ? (
        <ContactPanel id={panelId} onClose={() => openPanel(null)} onChanged={() => void load(0)} />
      ) : null}

      <ImportDialog open={dialog === "import"} onClose={() => setDialog(null)} onDone={() => load(0)} />
      <AddContactDialog
        open={dialog === "add"}
        onClose={() => setDialog(null)}
        onDone={(id) => {
          void load(0);
          openPanel(id);
        }}
      />
      <HeaderActions exportHref={`/api/contacts/export?${queryString}`} />
    </>
  );
}

function HeaderActions({ exportHref }: { exportHref: string }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("contacts-actions")), []);
  if (!host) return null;
  return (
    <PortalInto host={host}>
      <div className="btn-group">
        <a className="btn btn-quiet hide-mobile" href={exportHref}>
          <Download size={15} /> Pobierz listę (CSV)
        </a>
      </div>
    </PortalInto>
  );
}

function PortalInto({ host, children }: { host: HTMLElement; children: React.ReactNode }) {
  return createPortal(children, host);
}

function chipLabel(k: string, v: unknown): string {
  const arr = Array.isArray(v) ? (v as string[]) : [String(v)];
  const map = (fn: (x: string) => string) => arr.map(fn).join(", ");
  switch (k) {
    case "sector":
      return `Sektor: ${map((x) => SECTOR_LABEL[x] ?? x)}`;
    case "size":
      return `Wielkość: ${map((x) => SIZE_LABEL[x as keyof typeof SIZE_LABEL] ?? x)}`;
    case "role":
      return `Rola: ${map((x) => ROLE_LABEL[x as keyof typeof ROLE_LABEL] ?? x)}`;
    case "withEmail":
      return "Tylko z adresem e-mail";
    case "dept":
      return `Dział: ${map((x) => FUNCTION_LABEL[x as keyof typeof FUNCTION_LABEL] ?? x)}`;
    case "kind":
      return `Rodzaj: ${map((x) => KIND_LABEL[x as keyof typeof KIND_LABEL] ?? x)}`;
    case "quality":
      return `Jakość: ${map((x) => QUALITY_LABEL[x as keyof typeof QUALITY_LABEL] ?? x)}`;
    case "email":
      return `Weryfikacja: ${map((x) => EMAIL_STATUS_LABEL[x as keyof typeof EMAIL_STATUS_LABEL] ?? x)}`;
    case "outreach":
      return `Korespondencja: ${map((x) => OUTREACH_LABEL[x as keyof typeof OUTREACH_LABEL] ?? x)}`;
    case "review":
      return `Przegląd: ${map((x) => ({ new: "nowe", accepted: "zaakceptowane", rejected: "odrzucone" })[x] ?? x)}`;
    case "verifiedOlderThan":
      return `Weryfikacja starsza niż ${arr[0]} dni`;
    case "fallback":
      return arr[0] === "only"
        ? "Tylko kontakty ogólne"
        : arr[0] === "include"
          ? "Z kontaktami ogólnymi"
          : "Bez kontaktów ogólnych";
    case "companyId":
      return "Jedna firma";
    default:
      return `${k}: ${arr.join(", ")}`;
  }
}

function EmptyContacts({
  view,
  filtered,
  onImport,
}: {
  view?: string;
  filtered: boolean;
  onImport: () => void;
}) {
  if (filtered) {
    return (
      <Empty icon={<Filter size={22} />} title="Brak wyników dla tych filtrów">
        Zmień lub wyczyść filtry. Kontakty ogólne (info@, rekrutacja) są ukryte w widoku „Do kontaktu”.
      </Empty>
    );
  }
  if (view === "latest-run") {
    return (
      <Empty
        icon={<Users size={22} />}
        title="Ostatni przebieg nie dodał nowych kontaktów"
        actions={
          <Link className="btn" href="/kontakty/odkrywanie">
            Zobacz przebiegi
          </Link>
        }
      >
        Odkrywanie zwraca mniej kontaktów, gdy jakość źródeł jest niewystarczająca. To zamierzone.
      </Empty>
    );
  }
  return (
    <Empty
      icon={<Users size={22} />}
      title="Brak kontaktów w tym widoku"
      actions={
        <>
          <Link className="btn btn-primary" href="/kontakty/odkrywanie">
            Uruchom odkrywanie
          </Link>
          <button type="button" className="btn" onClick={onImport}>
            Importuj CSV
          </button>
        </>
      }
    >
      Kontakty pojawiają się po przebiegu odkrywania (codziennie o ustalonej porze) albo po imporcie. Nowe
      trafiają najpierw do przeglądu — nic nie jest wysyłane automatycznie.
    </Empty>
  );
}

function FiltersButton({
  open,
  setOpen,
  query,
  setQuery,
  activeCount,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  query: Partial<ContactQuery>;
  setQuery: (p: Partial<ContactQuery>) => void;
  activeCount: number;
}) {
  const ref = useDismiss(open, () => setOpen(false));
  const groups: {
    key: keyof ContactQuery;
    label: string;
    options: readonly string[];
    labels: Record<string, string>;
  }[] = [
    { key: "dept", label: "Dział", options: ROLE_FUNCTIONS, labels: FUNCTION_LABEL },
    { key: "role", label: "Kategoria roli", options: ROLE_CATEGORIES, labels: ROLE_LABEL },
    { key: "kind", label: "Rodzaj", options: CONTACT_KINDS, labels: KIND_LABEL },
    { key: "quality", label: "Jakość danych", options: QUALITIES, labels: QUALITY_LABEL },
    { key: "email", label: "Weryfikacja adresu", options: EMAIL_STATUSES, labels: EMAIL_STATUS_LABEL },
    { key: "outreach", label: "Korespondencja", options: OUTREACH, labels: OUTREACH_LABEL },
    { key: "sector", label: "Sektor", options: Object.keys(SECTOR_LABEL), labels: SECTOR_LABEL },
    { key: "size", label: "Wielkość firmy", options: SIZE_BANDS, labels: SIZE_LABEL },
    {
      key: "review",
      label: "Przegląd",
      options: ["new", "accepted", "rejected"],
      labels: { new: "Nowe", accepted: "Zaakceptowane", rejected: "Odrzucone" },
    },
  ];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Filter size={15} /> Filtry
        {activeCount ? <span className="tag tag-accent">{activeCount}</span> : null}
      </button>
      {open ? (
        <div className="popover popover-filters" role="dialog" aria-label="Filtry">
          <div className="grid-2" style={{ gap: 16 }}>
            {groups.map((g) => {
              const current = (query[g.key] as string[] | undefined) ?? [];
              return (
                <fieldset key={g.key} style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="menu-label" style={{ padding: "0 0 6px" }}>
                    {g.label}
                  </legend>
                  <div className="stack" style={{ gap: 4 }}>
                    {g.options.map((o) => (
                      <label key={o} className="check-row small">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={current.includes(o)}
                          onChange={(e) => {
                            const next = e.target.checked ? [...current, o] : current.filter((x) => x !== o);
                            setQuery({ [g.key]: next } as Partial<ContactQuery>);
                          }}
                        />
                        {g.labels[o] ?? o}
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="menu-label" style={{ padding: "0 0 6px" }}>
                Świeżość i kontakty ogólne
              </legend>
              <div className="stack" style={{ gap: 6 }}>
                <label className="check-row small">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={Boolean(query.verifiedOlderThan)}
                    onChange={(e) => setQuery({ verifiedOlderThan: e.target.checked ? 90 : undefined })}
                  />
                  Weryfikacja starsza niż 90 dni lub brak
                </label>
                <select
                  className="select"
                  value={query.fallback ?? ""}
                  onChange={(e) =>
                    setQuery({ fallback: (e.target.value || undefined) as ContactQuery["fallback"] })
                  }
                  aria-label="Kontakty ogólne"
                >
                  <option value="">Kontakty ogólne: wg widoku</option>
                  <option value="exclude">Ukryj kontakty ogólne</option>
                  <option value="include">Pokaż też kontakty ogólne</option>
                  <option value="only">Tylko kontakty ogólne</option>
                </select>
              </div>
            </fieldset>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** First-use guide: the whole daily flow in three steps. Hidden once dismissed (this browser only). */
function HowItWorks() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem("mtg-howto-hidden") !== "1");
    } catch {
      setOpen(true);
    }
  }, []);
  if (!open)
    return (
      <button
        type="button"
        className="link-button small"
        style={{ alignSelf: "flex-start", marginBottom: 8 }}
        onClick={() => {
          setOpen(true);
          try {
            localStorage.removeItem("mtg-howto-hidden");
          } catch {
            /* ignore */
          }
        }}
      >
        Jak to działa?
      </button>
    );
  const hide = () => {
    setOpen(false);
    try {
      localStorage.setItem("mtg-howto-hidden", "1");
    } catch {
      /* private mode: show again next time */
    }
  };
  return (
    <section className="howto card" aria-label="Jak to działa">
      <div className="row-between">
        <h3>Jak to działa</h3>
        <button type="button" className="btn btn-quiet btn-sm" onClick={hide}>
          Rozumiem, ukryj
        </button>
      </div>
      <ol className="howto-steps">
        <li>
          <strong>Wybierz z listy osobę albo dział.</strong> Najlepsze kontakty są na górze. Aplikacja sama
          dokłada nowe firmy i adresy każdego ranka.
        </li>
        <li>
          <strong>Kliknij „Przygotuj email”.</strong> Gotowy tekst dopasowany do działu i firmy pojawi się od
          razu — popraw, co chcesz.
        </li>
        <li>
          <strong>Skopiuj go do swojej poczty i wyślij, potem kliknij „Wysłane”.</strong> Aplikacja zapamięta,
          do kogo i kiedy wysłano wiadomość, i przypomni o odpowiedzi.
        </li>
      </ol>
    </section>
  );
}
