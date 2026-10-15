"use client";

import { Check, FileText, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { Callout, Dialog, Dot, Empty } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { formatWarsaw } from "@/lib/time";
import type { ProgramField, ProgramSummary } from "@/server/db/schema";
import type { SettingsOf } from "@/server/settings";
import { uploadVersion } from "./upload";

type Version = {
  id: string;
  version: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  complete: boolean;
  extractionStatus: string;
  extractionError: string | null;
  textLength: number;
  approvedAt: string | null;
  createdAt: string;
};
type Doc = {
  id: string;
  programId: string | null;
  title: string;
  usage: "internal" | "quotable" | "attachment";
  approvedAt: string | null;
  versions: Version[];
};
type Program = {
  id: string;
  name: string;
  status: "draft" | "approved" | "archived";
  summary: ProgramSummary;
  summarySource: string | null;
  defaultAttachmentVersionId: string | null;
  approvedAt: string | null;
};
type Library = { programs: Program[]; documents: Doc[]; ai: boolean; profile: SettingsOf<"profile"> };

const USAGE: Record<Doc["usage"], { label: string; hint: string }> = {
  internal: { label: "Tło wewnętrzne", hint: "Do Twojej wiedzy. Nie jest cytowane w mailach." },
  quotable: {
    label: "Materiał do cytowania",
    hint: "Po zatwierdzeniu AI może z niego korzystać w treści maili.",
  },
  attachment: {
    label: "Załącznik do wysyłki",
    hint: "Po zatwierdzeniu może być dołączany do maili (dokładna wersja jest zapamiętywana).",
  },
};

export function MaterialsView() {
  const toast = useToast();
  const [lib, setLib] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"programs" | "documents" | "profile">("programs");
  const [uploadOpen, setUploadOpen] = useState<{ programId: string | null; documentId?: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    try {
      setLib(await apiFetch<Library>("/api/materials"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nie udało się wczytać");
    }
  }, []);
  useEffect(() => {
    void load();
    if (window.location.hash === "#profil") setTab("profile");
    if (window.location.hash === "#dokumenty") setTab("documents");
  }, [load]);

  if (error) return <Callout tone="bad">{error}</Callout>;
  if (!lib) return <span className="skeleton" style={{ width: "40%" }} />;

  return (
    <div className="stack-lg">
      <div className="segmented" role="tablist" aria-label="Sekcje materiałów">
        {(
          [
            ["programs", `Programy (${lib.programs.filter((p) => p.status !== "archived").length})`],
            ["documents", `Pliki (${lib.documents.length})`],
            ["profile", "Profil i głos"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === "programs" ? (
        <Programs lib={lib} reload={load} onUpload={(programId) => setUploadOpen({ programId })} />
      ) : null}
      {tab === "documents" ? (
        <Documents
          lib={lib}
          reload={load}
          onUpload={(programId, documentId) => setUploadOpen({ programId, documentId })}
        />
      ) : null}
      {tab === "profile" ? <Profile initial={lib.profile} onSaved={() => toast("Zapisano profil")} /> : null}

      <UploadDialog
        open={uploadOpen}
        programs={lib.programs}
        onClose={() => setUploadOpen(null)}
        onDone={load}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Programmes
// ---------------------------------------------------------------------------

function Programs({
  lib,
  reload,
  onUpload,
}: {
  lib: Library;
  reload: () => void;
  onUpload: (programId: string | null) => void;
}) {
  const toast = useToast();
  const active = lib.programs.filter((p) => p.status !== "archived");
  async function create() {
    const name = window.prompt("Nazwa programu");
    if (!name) return;
    await apiFetch("/api/programs", { body: { name } });
    reload();
  }
  if (active.length === 0) {
    return (
      <div className="card">
        <Empty
          icon={<FileText size={22} />}
          title="Brak programów"
          actions={
            <button type="button" className="btn btn-primary" onClick={create}>
              <Plus size={15} /> Dodaj program
            </button>
          }
        >
          Program to opis oferty, z którego korzysta generator maili: odbiorcy, problem, efekty, format.
          Możesz go wpisać lub wgrać ofertę (PDF, JPG) i poprosić AI o propozycję streszczenia.
        </Empty>
      </div>
    );
  }
  return (
    <div className="stack-lg">
      <div className="row-between">
        <p className="secondary small">
          Szkic programu nie jest używany w mailach, dopóki go nie zatwierdzisz. Pola z cytatem pokazują, skąd
          pochodzą.
        </p>
        <button type="button" className="btn" onClick={create}>
          <Plus size={15} /> Dodaj program
        </button>
      </div>
      {active.map((p) => (
        <ProgramCard
          key={p.id}
          p={p}
          lib={lib}
          reload={reload}
          onUpload={() => onUpload(p.id)}
          toast={toast}
        />
      ))}
    </div>
  );
}

const FIELDS: { key: keyof ProgramSummary; label: string; list?: boolean }[] = [
  { key: "audience", label: "Dla kogo" },
  { key: "problem", label: "Problem biznesowy" },
  { key: "outcomes", label: "Efekty / rezultaty", list: true },
  { key: "keyPoints", label: "Elementy programu", list: true },
  { key: "format", label: "Format" },
  { key: "duration", label: "Czas trwania" },
  { key: "language", label: "Język" },
  { key: "pricing", label: "Cena (tylko jeśli podana wprost)" },
];

function ProgramCard({
  p,
  lib,
  reload,
  onUpload,
  toast,
}: {
  p: Program;
  lib: Library;
  reload: () => void;
  onUpload: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  const [edit, setEdit] = useState(false);
  const [summary, setSummary] = useState<ProgramSummary>(p.summary);
  const [busy, setBusy] = useState(false);
  const [unverified, setUnverified] = useState<string[]>([]);
  useEffect(() => setSummary(p.summary), [p.summary]);
  const docs = lib.documents.filter((d) => d.programId === p.id);
  const attachVersions = docs
    .filter((d) => d.usage === "attachment" && d.approvedAt)
    .flatMap((d) =>
      d.versions.filter((v) => v.approvedAt && v.complete).map((v) => ({ ...v, title: d.title })),
    );

  async function patch(body: Record<string, unknown>, msg: string) {
    try {
      await apiFetch(`/api/programs/${p.id}`, { method: "PATCH", body });
      toast(msg);
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie udało się", "error");
    }
  }

  async function propose() {
    const versionIds = docs.flatMap((d) => (d.versions[0]?.complete ? [d.versions[0].id] : [])).slice(0, 5);
    if (!versionIds.length) {
      toast("Najpierw wgraj plik oferty dla tego programu", "error");
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch<{ unverified: string[] }>(`/api/programs/${p.id}/propose`, {
        body: { versionIds },
      });
      setUnverified(r.unverified);
      toast("Propozycja gotowa — przejrzyj i zatwierdź");
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie udało się", "error");
    } finally {
      setBusy(false);
    }
  }

  const fieldText = (f: ProgramField | ProgramField[] | null | undefined) =>
    Array.isArray(f) ? f.map((x) => x.value).join("\n") : (f?.value ?? "");

  return (
    <section className="card card-pad stack">
      <div className="row-between wrap">
        <div>
          <h3>{p.name}</h3>
          <div className="row small secondary" style={{ marginTop: 4, gap: 10 }}>
            <span className="status">
              <Dot tone={p.status === "approved" ? "ok" : "hollow"} />
              {p.status === "approved"
                ? `Zatwierdzony ${formatWarsaw(p.approvedAt, "d LLL yyyy")}`
                : "Szkic — nieużywany w mailach"}
            </span>
            {p.summarySource ? <span className="muted xsmall">{p.summarySource}</span> : null}
          </div>
        </div>
        <div className="btn-group">
          {lib.ai ? (
            <button type="button" className="btn btn-quiet btn-sm" onClick={propose} disabled={busy}>
              {busy ? <span className="spinner" /> : <Sparkles size={13} />} Zaproponuj z plików
            </button>
          ) : null}
          <button type="button" className="btn btn-quiet btn-sm" onClick={onUpload}>
            <Upload size={13} /> Wgraj ofertę
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setEdit(!edit)}>
            {edit ? "Zamknij edycję" : "Edytuj"}
          </button>
          {p.status !== "approved" ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => patch({ status: "approved" }, "Program zatwierdzony")}
            >
              <Check size={13} /> Zatwierdź
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => patch({ status: "draft" }, "Cofnięto zatwierdzenie")}
            >
              Cofnij zatwierdzenie
            </button>
          )}
        </div>
      </div>
      {unverified.length ? (
        <Callout tone="warn">
          <strong>Sprawdź ręcznie: {unverified.join(", ")}</strong>
          <span>
            Cytatu nie znaleziono w tekście pliku (albo źródłem jest obraz). Nic nie zostało dopisane bez
            źródła.
          </span>
        </Callout>
      ) : null}
      {edit ? (
        <div className="stack">
          {FIELDS.map((f) => (
            <label key={f.key} className="field">
              <span className="field-label">
                {f.label}
                {f.list ? " (jeden w linii)" : ""}
              </span>
              <textarea
                className="textarea"
                rows={f.list ? 3 : 2}
                value={fieldText(summary[f.key] as ProgramField | ProgramField[] | null)}
                onChange={(e) => {
                  const v = e.target.value;
                  setSummary((s) => ({
                    ...s,
                    [f.key]: f.list
                      ? v
                          .split("\n")
                          .filter((x) => x.trim())
                          .map((value) => ({ value, quote: null, quoteVerified: false }))
                      : v.trim()
                        ? { value: v, quote: null, quoteVerified: false }
                        : f.key === "pricing"
                          ? null
                          : undefined,
                  }));
                }}
              />
            </label>
          ))}
          <div className="btn-group">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                patch({ summary }, "Zapisano — program wraca do przeglądu").then(() => setEdit(false))
              }
            >
              Zapisz
            </button>
            <span className="xsmall muted">
              Edycja cofa zatwierdzenie; zatwierdź ponownie po przejrzeniu.
            </span>
          </div>
        </div>
      ) : (
        <dl className="kv">
          {FIELDS.map((f) => {
            const v = p.summary[f.key] as ProgramField | ProgramField[] | null | undefined;
            const items = Array.isArray(v) ? v : v ? [v] : [];
            if (!items.length) return null;
            return (
              <div key={f.key} style={{ display: "contents" }}>
                <dt>{f.label}</dt>
                <dd className="stack" style={{ gap: 4 }}>
                  {items.map((x) => (
                    <span key={x.value}>
                      {x.value}
                      {x.quote ? (
                        <span className="xsmall muted" title={x.quote}>
                          {" "}
                          · {x.quoteVerified ? "cytat ze źródła ✓" : "cytat do sprawdzenia"}
                        </span>
                      ) : null}
                    </span>
                  ))}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      <div className="row wrap" style={{ gap: 12 }}>
        <span className="small secondary">Domyślny załącznik:</span>
        <select
          className="select"
          style={{ width: 320 }}
          value={p.defaultAttachmentVersionId ?? ""}
          onChange={(e) =>
            patch({ defaultAttachmentVersionId: e.target.value || null }, "Ustawiono domyślny załącznik")
          }
        >
          <option value="">Brak</option>
          {attachVersions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title} — {v.filename} (v{v.version})
            </option>
          ))}
        </select>
        {attachVersions.length === 0 ? (
          <span className="xsmall muted">Wgraj plik typu „Załącznik do wysyłki” i zatwierdź wersję.</span>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

function Documents({
  lib,
  reload,
  onUpload,
}: {
  lib: Library;
  reload: () => void;
  onUpload: (programId: string | null, documentId?: string) => void;
}) {
  const toast = useToast();
  const [textOf, setTextOf] = useState<{ title: string; text: string } | null>(null);
  async function approve(v: Version, approve: boolean) {
    await apiFetch(`/api/versions/${v.id}/approve`, { body: { approve } });
    toast(approve ? "Wersja zatwierdzona" : "Cofnięto zatwierdzenie");
    reload();
  }
  async function setUsage(d: Doc, usage: Doc["usage"]) {
    await apiFetch(`/api/documents/${d.id}`, { method: "PATCH", body: { usage } });
    toast("Zmieniono przeznaczenie — wymaga ponownego zatwierdzenia");
    reload();
  }
  if (lib.documents.length === 0) {
    return (
      <div className="card">
        <Empty
          icon={<Upload size={22} />}
          title="Brak plików"
          actions={
            <button type="button" className="btn btn-primary" onClick={() => onUpload(null)}>
              <Upload size={15} /> Wgraj plik
            </button>
          }
        >
          Obsługiwane: PDF, DOCX, PPTX, TXT oraz obrazy JPG/PNG (np. oferta jako grafika). Pliki są prywatne —
          dostępne tylko po zalogowaniu.
        </Empty>
      </div>
    );
  }
  return (
    <div className="stack">
      <div className="row-between">
        <p className="secondary small">
          Trzy rodzaje: tło wewnętrzne (nie cytowane), materiał do cytowania, załącznik do wysyłki. Każdy
          wymaga zatwierdzenia wersji.
        </p>
        <button type="button" className="btn" onClick={() => onUpload(null)}>
          <Upload size={15} /> Wgraj plik
        </button>
      </div>
      <div className="list">
        {lib.documents.map((d) => {
          const v = d.versions[0];
          const prog = lib.programs.find((p) => p.id === d.programId);
          return (
            <div key={d.id} className="list-row" style={{ alignItems: "flex-start" }}>
              <FileText size={18} className="muted" style={{ marginTop: 2 }} />
              <div className="list-row-main stack" style={{ gap: 6 }}>
                <div className="row-between wrap">
                  <strong>{d.title}</strong>
                  <div className="btn-group">
                    <select
                      className="select"
                      style={{ width: 210, height: 28 }}
                      value={d.usage}
                      onChange={(e) => setUsage(d, e.target.value as Doc["usage"])}
                      aria-label="Przeznaczenie"
                    >
                      {Object.entries(USAGE).map(([k, u]) => (
                        <option key={k} value={k}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm"
                      onClick={() => onUpload(d.programId, d.id)}
                    >
                      Nowa wersja
                    </button>
                    <button
                      type="button"
                      className="btn btn-quiet btn-icon btn-sm"
                      aria-label="Usuń dokument"
                      onClick={async () => {
                        if (
                          !window.confirm(
                            "Usunąć dokument? Wersje użyte w wysłanych mailach nie mogą zostać usunięte.",
                          )
                        )
                          return;
                        try {
                          await apiFetch(`/api/documents/${d.id}`, { method: "DELETE" });
                          reload();
                        } catch (e) {
                          toast(
                            e instanceof ApiError
                              ? e.message
                              : "Nie można usunąć (plik użyty w wysłanej wiadomości)",
                            "error",
                          );
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="xsmall muted">
                  {USAGE[d.usage].hint} {prog ? `· Program: ${prog.name}` : ""}
                </div>
                {d.versions.map((x) => (
                  <div key={x.id} className="row wrap small" style={{ gap: 10 }}>
                    <span className="tag">v{x.version}</span>
                    <a
                      href={`/api/versions/${x.id}/file${x.mimeType === "application/pdf" ? "?inline=1" : ""}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {x.filename}
                    </a>
                    <span className="muted">{(x.sizeBytes / 1024 / 1024).toFixed(2)} MB</span>
                    <span className="status">
                      <Dot
                        tone={
                          x.extractionStatus === "ok"
                            ? "ok"
                            : x.extractionStatus === "partial"
                              ? "warn"
                              : x.extractionStatus === "pending"
                                ? "hollow"
                                : "bad"
                        }
                      />
                      {{
                        ok: "tekst odczytany",
                        partial: "odczyt częściowy",
                        unsupported: "format nieobsługiwany",
                        failed: "błąd odczytu",
                        pending: "przetwarzanie",
                      }[x.extractionStatus] ?? x.extractionStatus}
                    </span>
                    {x.textLength > 0 ? (
                      <button
                        type="button"
                        className="link-button xsmall"
                        onClick={async () => {
                          const t = await apiFetch<{ text: string }>(`/api/versions/${x.id}/text`);
                          setTextOf({ title: x.filename, text: t.text });
                        }}
                      >
                        Pokaż tekst
                      </button>
                    ) : null}
                    {x.approvedAt ? (
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        onClick={() => approve(x, false)}
                      >
                        <Check size={12} /> Zatwierdzona
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => approve(x, true)}
                        disabled={!x.complete}
                      >
                        Zatwierdź wersję
                      </button>
                    )}
                    {x.extractionError ? (
                      <span className="xsmall" style={{ color: "var(--warn)" }}>
                        {x.extractionError}
                      </span>
                    ) : null}
                  </div>
                ))}
                {v ? null : <span className="muted xsmall">Brak wersji</span>}
              </div>
            </div>
          );
        })}
      </div>
      <Dialog
        open={Boolean(textOf)}
        onClose={() => setTextOf(null)}
        title={textOf?.title ?? ""}
        wide
        description="Tekst odczytany z pliku (tak widzi go AI)."
      >
        <div className="preview-mail" style={{ maxHeight: 480 }}>
          {textOf?.text}
        </div>
      </Dialog>
    </div>
  );
}

function UploadDialog({
  open,
  programs,
  onClose,
  onDone,
}: {
  open: { programId: string | null; documentId?: string } | null;
  programs: Program[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [usage, setUsage] = useState<Doc["usage"]>("attachment");
  const [programId, setProgramId] = useState<string>("");
  const [progress, setProgress] = useState<number | null>(null);
  useEffect(() => {
    setFile(null);
    setTitle("");
    setProgress(null);
    setProgramId(open?.programId ?? "");
  }, [open]);
  async function go() {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast("Plik jest większy niż 15 MB", "error");
      return;
    }
    try {
      setProgress(0);
      let docId = open?.documentId;
      if (!docId) {
        const d = await apiFetch<{ id: string }>("/api/documents", {
          body: { title: title || file.name.replace(/\.[^.]+$/, ""), usage, programId: programId || null },
        });
        docId = d.id;
      }
      const r = await uploadVersion(docId, file, setProgress);
      toast(r.extractionStatus === "ok" ? "Wgrano i odczytano tekst" : `Wgrano. ${r.extractionError ?? ""}`);
      onDone();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Nie udało się wgrać", "error");
      setProgress(null);
    }
  }
  return (
    <Dialog
      open={Boolean(open)}
      onClose={onClose}
      title={open?.documentId ? "Nowa wersja pliku" : "Wgraj plik"}
      description="PDF, DOCX, PPTX, TXT, JPG lub PNG, do 15 MB. Plik pozostaje prywatny."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Anuluj
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!file || progress !== null}
            onClick={go}
          >
            {progress !== null ? <span className="spinner" /> : null} Wgraj
          </button>
        </>
      }
    >
      <input
        type="file"
        accept=".pdf,.docx,.pptx,.txt,.md,.jpg,.jpeg,.png,.webp"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        aria-label="Plik"
      />
      {!open?.documentId ? (
        <>
          <label className="field">
            <span className="field-label">Tytuł</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={file?.name ?? "np. Oferta — Leading Through the AI Shift"}
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span className="field-label">Przeznaczenie</span>
              <select
                className="select"
                value={usage}
                onChange={(e) => setUsage(e.target.value as Doc["usage"])}
              >
                {Object.entries(USAGE).map(([k, u]) => (
                  <option key={k} value={k}>
                    {u.label}
                  </option>
                ))}
              </select>
              <span className="field-hint">{USAGE[usage].hint}</span>
            </label>
            <label className="field">
              <span className="field-label">Program</span>
              <select className="select" value={programId} onChange={(e) => setProgramId(e.target.value)}>
                <option value="">Bez programu</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      ) : null}
      {progress !== null ? (
        <div className="bar">
          <span style={{ width: `${Math.max(5, progress * 100)}%`, background: "var(--accent)" }} />
        </div>
      ) : null}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Profile & voice
// ---------------------------------------------------------------------------

function Profile({ initial, onSaved }: { initial: SettingsOf<"profile">; onSaved: () => void }) {
  const toast = useToast();
  const [p, setP] = useState(initial);
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => setP((x) => ({ ...x, [k]: v }));
  async function save() {
    try {
      await apiFetch("/api/settings/profile", { method: "PUT", body: p });
      onSaved();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie zapisano", "error");
    }
  }
  return (
    <div className="stack-lg" id="profil">
      <section className="card card-pad stack">
        <h3>Nadawca</h3>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Imię i nazwisko nadawcy</span>
            <input
              className="input"
              value={p.senderName}
              onChange={(e) => set("senderName", e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Rola</span>
            <input
              className="input"
              value={p.senderRole}
              onChange={(e) => set("senderRole", e.target.value)}
              placeholder="np. Trenerka i facylitatorka"
            />
          </label>
          <label className="field">
            <span className="field-label">Firma</span>
            <input
              className="input"
              value={p.businessName}
              onChange={(e) => set("businessName", e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Strona (jedyny link dozwolony w mailach)</span>
            <input className="input" value={p.website} onChange={(e) => set("website", e.target.value)} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Głos</span>
            <select
              className="select"
              value={p.voice}
              onChange={(e) => set("voice", e.target.value as typeof p.voice)}
            >
              <option value="singular">„Ja” (1. os. l. poj.)</option>
              <option value="plural">„My” (1. os. l. mn.)</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Forma gramatyczna nadawcy (PL)</span>
            <select
              className="select"
              value={p.plGrammaticalGender}
              onChange={(e) => set("plGrammaticalGender", e.target.value as typeof p.plGrammaticalGender)}
            >
              <option value="avoid">Unikaj form rodzajowych</option>
              <option value="feminine">Żeńska („pracowałam”)</option>
              <option value="masculine">Męska („pracowałem”)</option>
            </select>
            <span className="field-hint">Nic nie jest zgadywane — wybierasz sama/sam.</span>
          </label>
        </div>
      </section>

      <section className="card card-pad stack">
        <div className="row-between">
          <h3>Zatwierdzone fakty o Tobie</h3>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() =>
              set("facts", [...p.facts, { id: `f-${Date.now()}`, text: "", source: "", approved: false }])
            }
          >
            <Plus size={13} /> Dodaj fakt
          </button>
        </div>
        <p className="xsmall muted">
          Generator może użyć tylko zatwierdzonych faktów. Nie dodawaj wyników ani klientów, których nie
          możesz potwierdzić.
        </p>
        {p.facts.length === 0 ? <p className="small secondary">Brak faktów.</p> : null}
        {p.facts.map((f, i) => (
          <div key={f.id} className="row" style={{ alignItems: "flex-start", gap: 10 }}>
            <input
              type="checkbox"
              className="checkbox"
              style={{ marginTop: 9 }}
              checked={f.approved}
              aria-label="Zatwierdzony"
              onChange={(e) =>
                set(
                  "facts",
                  p.facts.map((x, j) => (j === i ? { ...x, approved: e.target.checked } : x)),
                )
              }
            />
            <div className="stack" style={{ flex: 1, gap: 4 }}>
              <input
                className="input"
                value={f.text}
                onChange={(e) =>
                  set(
                    "facts",
                    p.facts.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                  )
                }
              />
              <input
                className="input"
                style={{ height: 28, fontSize: 12 }}
                value={f.source}
                placeholder="Źródło (URL lub opis)"
                onChange={(e) =>
                  set(
                    "facts",
                    p.facts.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)),
                  )
                }
              />
            </div>
            <button
              type="button"
              className="btn btn-quiet btn-icon btn-sm"
              aria-label="Usuń fakt"
              onClick={() =>
                set(
                  "facts",
                  p.facts.filter((_, j) => j !== i),
                )
              }
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </section>

      <section className="card card-pad stack">
        <h3>Styl</h3>
        <label className="field">
          <span className="field-label">Preferencje tonu</span>
          <textarea
            className="textarea"
            rows={3}
            value={p.toneNotes}
            onChange={(e) => set("toneNotes", e.target.value)}
            placeholder="np. konkretnie, ciepło, bez korporacyjnego żargonu; krótkie akapity"
          />
        </label>
        <label className="field">
          <span className="field-label">Unikaj zwrotów (po przecinku)</span>
          <input
            className="input"
            value={p.avoidPhrases.join(", ")}
            onChange={(e) =>
              set(
                "avoidPhrases",
                e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              )
            }
          />
        </label>
        <div className="row-between">
          <span className="field-label">
            Przykłady Twojego pisania (zatwierdzone wpływają na styl, nie na fakty)
          </span>
          <div className="btn-group">
            {(["pl", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                className="btn btn-sm"
                onClick={() =>
                  set("samples", [
                    ...p.samples,
                    { id: `s-${Date.now()}`, language: l, text: "", approved: false },
                  ])
                }
              >
                <Plus size={13} /> Przykład {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {p.samples.map((s, i) => (
          <div key={s.id} className="stack" style={{ gap: 4 }}>
            <div className="row small">
              <span className="tag">{s.language.toUpperCase()}</span>
              <label className="check-row small">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={s.approved}
                  onChange={(e) =>
                    set(
                      "samples",
                      p.samples.map((x, j) => (j === i ? { ...x, approved: e.target.checked } : x)),
                    )
                  }
                />
                Zatwierdzony
              </label>
              <button
                type="button"
                className="link-button xsmall"
                onClick={() =>
                  set(
                    "samples",
                    p.samples.filter((_, j) => j !== i),
                  )
                }
              >
                Usuń
              </button>
            </div>
            <textarea
              className="textarea"
              rows={4}
              value={s.text}
              onChange={(e) =>
                set(
                  "samples",
                  p.samples.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                )
              }
            />
          </div>
        ))}
        <p className="xsmall muted">
          Twój styl nie zmienia się po cichu na podstawie pojedynczych edycji — tylko przez zatwierdzone
          przykłady i preferencje powyżej.
        </p>
      </section>

      <section className="card card-pad stack">
        <h3>Podpis i wezwanie do działania</h3>
        <div className="grid-2">
          <label className="field">
            <span className="field-label">Podpis PL</span>
            <textarea
              className="textarea"
              rows={4}
              value={p.signaturePl}
              onChange={(e) => set("signaturePl", e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Signature EN</span>
            <textarea
              className="textarea"
              rows={4}
              value={p.signatureEn}
              onChange={(e) => set("signatureEn", e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Preferowane wezwanie PL</span>
            <input
              className="input"
              value={p.defaultCtaPl}
              onChange={(e) => set("defaultCtaPl", e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Preferred CTA EN</span>
            <input
              className="input"
              value={p.defaultCtaEn}
              onChange={(e) => set("defaultCtaEn", e.target.value)}
            />
          </label>
        </div>
      </section>
      <div>
        <button type="button" className="btn btn-primary btn-lg" onClick={save}>
          Zapisz profil
        </button>
      </div>
    </div>
  );
}
