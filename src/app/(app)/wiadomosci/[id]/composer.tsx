"use client";

import {
  ArrowLeft,
  Check,
  Clipboard,
  Clock,
  ExternalLink as Ext,
  FileText,
  History,
  Mail,
  Paperclip,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { Callout, Dialog, Dot, EmailStatusLabel, hostOf } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { ROLE_LABEL } from "@/lib/contact-query";
import { ELIGIBILITY_LABEL } from "@/lib/contact-rules";
import { formatWarsaw } from "@/lib/time";
import type { ComposerData } from "@/server/services/composer";

type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";
type Salutation = "neutral" | "pani" | "pan";

const QUICK: { action: string; label: string }[] = [
  { action: "shorten", label: "Skróć" },
  { action: "more_direct", label: "Bardziej bezpośrednio" },
  { action: "warmer", label: "Cieplej" },
  { action: "stronger_value", label: "Mocniejsza wartość" },
  { action: "better_opening", label: "Lepsze otwarcie" },
  { action: "change_cta", label: "Zmień wezwanie" },
];

const STATUS_LABEL: Record<string, string> = {
  draft: "Szkic",
  approved: "Zatwierdzona",
  scheduled: "Zaplanowana",
  sending: "Wysyłanie…",
  sent: "Wysłana",
  failed: "Nie wysłano",
  uncertain: "Wynik wysyłki niepewny",
  cancelled: "Anulowana",
};

export function Composer({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [d, setD] = useState<ComposerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [save, setSave] = useState<SaveState>("saved");
  const [busy, setBusy] = useState<string | null>(null);
  const [selection, setSelection] = useState("");
  const [salutation, setSalutation] = useState<Salutation>("neutral");
  const [review, setReview] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const revision = useRef(0);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<ComposerData>(`/api/messages/${id}`);
      setD(data);
      setSubject(data.message.subject);
      setBody(data.message.body);
      revision.current = data.message.revision;
      setSave("saved");
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nie udało się wczytać wiadomości");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const editable = d ? ["draft", "approved", "failed"].includes(d.message.status) : false;

  const persist = useCallback(
    async (patch: Record<string, unknown>) => {
      setSave("saving");
      try {
        const r = await apiFetch<{ revision: number; status: string }>(`/api/messages/${id}`, {
          method: "PATCH",
          body: { ...patch, revision: revision.current },
        });
        revision.current = r.revision;
        setSave("saved");
        setD((x) =>
          x
            ? {
                ...x,
                message: {
                  ...x.message,
                  status: r.status as ComposerData["message"]["status"],
                  approval: r.status === "draft" ? null : x.message.approval,
                },
              }
            : x,
        );
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) setSave("conflict");
        else setSave("error");
      }
    },
    [id],
  );

  // Autosave (debounced). User edits are never overwritten without an explicit action.
  function onChange(next: { subject?: string; body?: string }) {
    if (next.subject !== undefined) setSubject(next.subject);
    if (next.body !== undefined) setBody(next.body);
    setSave("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist({ subject: next.subject ?? subjectRef.current, body: next.body ?? bodyRefText.current });
    }, 900);
  }
  const subjectRef = useRef(subject);
  const bodyRefText = useRef(body);
  subjectRef.current = subject;
  bodyRefText.current = body;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (saveTimer.current) clearTimeout(saveTimer.current);
        void persist({ subject: subjectRef.current, body: bodyRefText.current });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && editable) {
        e.preventDefault();
        setReview(true);
      }
    }
    window.addEventListener("keydown", onKey);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (save === "dirty" || save === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [persist, editable, save]);

  async function flush() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      await persist({ subject: subjectRef.current, body: bodyRefText.current });
    }
  }

  async function generate(overwrite = false) {
    await flush();
    setBusy("generate");
    try {
      const r = await apiFetch<{ warnings: { message: string }[] }>(`/api/messages/${id}/generate`, {
        body: { overwrite, salutation },
      });
      await load();
      toast(r.warnings.some((w) => w) ? "Szkic gotowy — sprawdź uwagi po prawej" : "Szkic gotowy");
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 409 &&
        (e.details as { needsConfirm?: boolean } | undefined)?.needsConfirm
      )
        setConfirmRegen(true);
      else toast(e instanceof ApiError ? e.message : "Generowanie nie powiodło się", "error");
    } finally {
      setBusy(null);
    }
  }

  async function quick(action: string) {
    await flush();
    setBusy(action);
    try {
      const r = await apiFetch<{ note: string }>(`/api/messages/${id}/rewrite`, {
        body: {
          action,
          salutation,
          ...(action === "rewrite_selection"
            ? {
                selection,
                instruction: window.prompt("Jak przepisać zaznaczony fragment? (opcjonalnie)") ?? "",
              }
            : {}),
        },
      });
      await load();
      toast(r.note || "Zmieniono — poprzednia wersja jest w historii");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie udało się", "error");
    } finally {
      setBusy(null);
    }
  }

  async function action(path: string, bodyJson: Record<string, unknown>, msg: string, method = "POST") {
    await flush();
    setBusy(path);
    try {
      await apiFetch(`/api/messages/${id}/${path}`, { method, body: bodyJson });
      toast(msg);
      await load();
    } catch (e) {
      const details =
        e instanceof ApiError && Array.isArray(e.details) ? `: ${(e.details as string[]).join("; ")}` : "";
      toast(`${e instanceof ApiError ? e.message : "Nie udało się"}${details}`, "error");
    } finally {
      setBusy(null);
    }
  }

  async function setAttachments(ids: string[]) {
    await flush();
    await persist({ attachmentVersionIds: ids });
    await load();
  }

  if (error) return <Callout tone="bad">{error}</Callout>;
  if (!d) {
    return (
      <div className="composer">
        <div className="letter card-pad stack">
          {[40, 70, 90, 80, 60].map((w) => (
            <span key={w} className="skeleton" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  const m = d.message;
  const c = d.contact?.contact;
  const gen = m.generation;
  const lintErrors = d.lint.filter((l) => l.level === "error");
  const lintWarnings = d.lint.filter((l) => l.level === "warning");
  const recipient = c?.fullName ?? c?.departmentLabel ?? m.toEmail ?? "Odbiorca";
  const mailto = `mailto:${encodeURIComponent(m.toEmail ?? "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(d.finalText)}`;
  const empty = !body.trim();

  return (
    <div className="stack-lg">
      <header className="row-between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 6 }}>
          <Link href="/wiadomosci" className="small secondary row" style={{ gap: 4 }}>
            <ArrowLeft size={14} /> Wiadomości
          </Link>
          <h1 style={{ fontSize: 22 }}>
            {recipient}{" "}
            <span className="secondary" style={{ fontWeight: 400 }}>
              · {d.companyName}
            </span>
          </h1>
          <div className="row wrap small secondary" style={{ gap: 12 }}>
            <span className="status">
              <Dot
                tone={
                  m.status === "sent"
                    ? "accent"
                    : m.status === "approved"
                      ? "ok"
                      : m.status === "uncertain" || m.status === "failed"
                        ? "bad"
                        : "hollow"
                }
              />
              {STATUS_LABEL[m.status] ?? m.status}
            </span>
            {m.kind === "follow_up" ? <span className="tag">Follow-up</span> : null}
            {editable ? (
              <span className="xsmall muted" aria-live="polite">
                {save === "saving"
                  ? "Zapisywanie…"
                  : save === "dirty"
                    ? "Niezapisane zmiany"
                    : save === "conflict"
                      ? "Konflikt wersji"
                      : save === "error"
                        ? "Błąd zapisu"
                        : "Zapisano"}
              </span>
            ) : null}
          </div>
        </div>
        <div className="btn-group">
          <button type="button" className="btn btn-quiet" onClick={() => setHistoryOpen(true)}>
            <History size={15} /> Historia ({d.revisions.length})
          </button>
          {editable ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setReview(true)}
              disabled={empty}
            >
              <Check size={15} /> Przejrzyj i zatwierdź
            </button>
          ) : null}
        </div>
      </header>

      {save === "conflict" ? (
        <Callout tone="bad">
          <span>
            Ta wiadomość zmieniła się w innym oknie.{" "}
            <button type="button" className="link-button" onClick={load}>
              Wczytaj aktualną wersję
            </button>{" "}
            (Twoja ostatnia zmiana nie została zapisana).
          </span>
        </Callout>
      ) : null}
      {m.status === "uncertain" ? (
        <Callout tone="bad">
          <strong>Nie wiadomo, czy wiadomość wyszła.</strong>
          <span>
            Nie ponawiamy automatycznie, aby nie wysłać jej dwa razy. Sprawdź folder Wysłane albo pozwól
            aplikacji to sprawdzić.
          </span>
          <div className="btn-group" style={{ marginTop: 6 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => action("reconcile", {}, "Sprawdzono")}
            >
              Sprawdź w Wysłanych
            </button>
            {d.sentSearchUrl ? (
              <a className="btn btn-sm" href={d.sentSearchUrl} target="_blank" rel="noopener noreferrer">
                Otwórz wyszukiwanie w Gmailu
              </a>
            ) : null}
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => action("resolve", { wasSent: true }, "Oznaczono jako wysłaną")}
            >
              Wysłano
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => action("resolve", { wasSent: false }, "Oznaczono: nie wysłano")}
            >
              Nie wysłano
            </button>
          </div>
        </Callout>
      ) : null}
      {m.sendError && m.status !== "uncertain" ? <Callout tone="bad">{m.sendError}</Callout> : null}

      <div className="composer">
        <div className="stack">
          <div className="letter">
            <div className="letter-meta">
              <span>Do</span>
              <div className="row wrap" style={{ gap: 8 }}>
                <span>{m.toEmail ?? <span className="muted">brak adresu</span>}</span>
                {c ? <EmailStatusLabel status={c.emailStatus} at={c.emailCheckedAt} /> : null}
              </div>
            </div>
            <div className="letter-meta">
              <span>Temat</span>
              <div>
                <input
                  className="subject-input"
                  value={subject}
                  onChange={(e) => onChange({ subject: e.target.value })}
                  placeholder="Temat wiadomości"
                  aria-label="Temat"
                  readOnly={!editable}
                />
              </div>
            </div>
            {editable && gen.subjectOptions?.length ? (
              <div className="subject-options" style={{ paddingTop: 10 }}>
                <span className="xsmall muted">Propozycje tematu</span>
                {gen.subjectOptions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="subject-option"
                    aria-pressed={subject === s}
                    onClick={() => onChange({ subject: s })}
                  >
                    {subject === s ? <Check size={13} /> : <span style={{ width: 13 }} />} {s}
                  </button>
                ))}
              </div>
            ) : null}
            {empty && editable ? (
              <div className="empty" style={{ padding: "48px 24px" }}>
                <Sparkles size={22} />
                <h3>Szkic jest pusty</h3>
                <p>
                  {d.ai
                    ? "Wygeneruj szkic na podstawie zatwierdzonego programu, roli odbiorcy i faktów o firmie — albo zacznij pisać samodzielnie."
                    : "Generowanie AI nie jest skonfigurowane. Napisz treść samodzielnie — linter nadal sprawdzi liczby, linki i obietnice."}
                </p>
                {d.ai ? (
                  <div className="btn-group">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => generate(false)}
                      disabled={busy !== null}
                    >
                      {busy === "generate" ? <span className="spinner" /> : <Sparkles size={15} />} Wygeneruj
                      szkic
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="link-button small"
                  onClick={() => onChange({ body: m.language === "pl" ? "Dzień dobry,\n\n" : "Hello,\n\n" })}
                >
                  Zacznij pisać
                </button>
              </div>
            ) : (
              <textarea
                ref={bodyRef}
                className="body-editor"
                value={body}
                onChange={(e) => onChange({ body: e.target.value })}
                onSelect={(e) => {
                  const t = e.currentTarget;
                  setSelection(t.value.slice(t.selectionStart, t.selectionEnd).trim());
                }}
                aria-label="Treść wiadomości"
                readOnly={!editable}
                spellCheck
                lang={m.language}
              />
            )}
            {editable && d.ai && !empty ? (
              <div className="quick-actions" role="toolbar" aria-label="Szybkie zmiany">
                {QUICK.map((q) => (
                  <button
                    key={q.action}
                    type="button"
                    className="btn btn-sm"
                    disabled={busy !== null}
                    onClick={() => quick(q.action)}
                  >
                    {busy === q.action ? <span className="spinner" /> : null} {q.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={busy !== null || selection.length < 8}
                  onClick={() => quick("rewrite_selection")}
                  title="Zaznacz fragment treści"
                >
                  Przepisz zaznaczenie
                </button>
                <span className="toolbar-spacer" />
                {gen.variants?.map((v) => (
                  <button
                    key={v.kind}
                    type="button"
                    className="btn btn-quiet btn-sm"
                    disabled={busy !== null}
                    onClick={() =>
                      action(
                        "variant",
                        { kind: v.kind },
                        "Wstawiono wariant — poprzednia wersja jest w historii",
                      )
                    }
                  >
                    {v.kind === "shorter" ? "Wariant krótszy" : "Wariant wyrazisty"}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  disabled={busy !== null}
                  onClick={() => generate(false)}
                >
                  {busy === "generate" ? <span className="spinner" /> : <RefreshCw size={13} />} Od nowa
                </button>
              </div>
            ) : null}
            <div className="attachments">
              <Paperclip size={14} className="muted" aria-hidden="true" />
              {d.attachments.length === 0 ? <span className="small muted">Bez załączników</span> : null}
              {d.attachments.map((a) => (
                <span key={a.versionId} className="attachment">
                  <FileText size={14} />
                  <a
                    href={`/api/versions/${a.versionId}/file${a.mimeType === "application/pdf" ? "?inline=1" : ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {a.filename}
                  </a>
                  <span className="xsmall muted">
                    v{a.version} · {(a.sizeBytes / 1024 / 1024).toFixed(1)} MB
                  </span>
                  {editable ? (
                    <button
                      type="button"
                      className="btn btn-quiet btn-icon btn-sm"
                      aria-label={`Usuń ${a.filename}`}
                      onClick={() =>
                        setAttachments(
                          d.attachments.filter((x) => x.versionId !== a.versionId).map((x) => x.versionId),
                        )
                      }
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </span>
              ))}
              {editable && d.attachable.length ? (
                <select
                  className="select"
                  style={{ width: 220, height: 30 }}
                  value=""
                  aria-label="Dodaj zatwierdzony załącznik"
                  onChange={(e) =>
                    e.target.value &&
                    setAttachments([...d.attachments.map((a) => a.versionId), e.target.value])
                  }
                >
                  <option value="">Dodaj zatwierdzony załącznik…</option>
                  {d.attachable
                    .filter((a) => !d.attachments.some((x) => x.versionId === a.versionId))
                    .map((a) => (
                      <option key={a.versionId} value={a.versionId}>
                        {a.title} — {a.filename} (v{a.version})
                      </option>
                    ))}
                </select>
              ) : null}
            </div>
          </div>
          {!d.profileReady ? (
            <Callout tone="info">
              <span>
                Uzupełnij nadawcę i podpis ({m.language.toUpperCase()}) w{" "}
                <Link href="/materialy#profil">Materiałach › Profil i głos</Link> — podpis jest dodawany
                automatycznie.
              </span>
            </Callout>
          ) : null}
        </div>

        <aside className="side-stack">
          {editable ? (
            <div className="side-card stack">
              <h4>Program i język</h4>
              <select
                className="select"
                value={m.programId ?? ""}
                onChange={async (e) => {
                  await flush();
                  await persist({ programId: e.target.value || null });
                  await load();
                  toast("Zmieniono program — wygeneruj szkic ponownie, jeśli treść ma się dopasować");
                }}
                aria-label="Program"
              >
                <option value="">Bez programu</option>
                {d.programs
                  .filter((p) => p.status === "approved" || p.id === m.programId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.status !== "approved" ? " (niezatwierdzony)" : ""}
                    </option>
                  ))}
              </select>
              <div className="row-between">
                <fieldset className="segmented" aria-label="Język">
                  {(["pl", "en"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={m.language === l}
                      onClick={async () => {
                        if (m.language === l) return;
                        await flush();
                        await persist({ language: l });
                        await load();
                        toast("Zmieniono język — użyj „Od nowa”, aby napisać treść w tym języku");
                      }}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </fieldset>
                {m.language === "pl" ? (
                  <select
                    className="select"
                    style={{ width: 150 }}
                    value={salutation}
                    onChange={(e) => setSalutation(e.target.value as Salutation)}
                    aria-label="Forma zwracania się"
                  >
                    <option value="neutral">Forma neutralna</option>
                    <option value="pani">Pani</option>
                    <option value="pan">Pan</option>
                  </select>
                ) : null}
              </div>
              {m.language === "pl" ? (
                <p className="xsmall muted">
                  Aplikacja nie zgaduje płci odbiorcy. Formę „Pani/Pan” wybierasz sama/sam.
                </p>
              ) : null}
            </div>
          ) : null}

          {c ? (
            <div className="side-card stack" style={{ gap: 10 }}>
              <h4>Odbiorca</h4>
              <div className="small">
                <div className="cell-primary">{recipient}</div>
                <div className="secondary">{c.title ?? ROLE_LABEL[c.roleCategory]}</div>
              </div>
              <dl className="kv" style={{ gridTemplateColumns: "100px 1fr", fontSize: 12.5 }}>
                <dt>Rola</dt>
                <dd>{ROLE_LABEL[c.roleCategory]}</dd>
                <dt>Podstawa</dt>
                <dd>{ELIGIBILITY_LABEL[c.eligibilityBasis]}</dd>
              </dl>
              {d.contact!.staleness.email || d.contact!.staleness.employment ? (
                <Callout tone="warn">
                  {d.contact!.staleness.reasons.map((r) => (
                    <span key={r}>{r}</span>
                  ))}
                  <button
                    type="button"
                    className="link-button small"
                    onClick={async () => {
                      const r = await apiFetch<{ message: string }>(`/api/contacts/${c.id}/verify`, {
                        body: {},
                      }).catch((e) => ({ message: e instanceof Error ? e.message : "Błąd" }));
                      toast(r.message);
                      void load();
                    }}
                  >
                    Sprawdź teraz
                  </button>
                </Callout>
              ) : null}
              {d.contact!.recentCompanyOutreach.length ? (
                <Callout tone="warn">
                  <strong>W tej firmie trwa korespondencja</strong>
                  {d.contact!.recentCompanyOutreach.map((r) => (
                    <span key={r.contactId}>
                      {r.who}, {formatWarsaw(r.at, "d LLL")}
                    </span>
                  ))}
                </Callout>
              ) : null}
              <Link href={`/kontakty?c=${c.id}&view=all`} className="small">
                Otwórz kontakt
              </Link>
            </div>
          ) : null}

          {gen.explanation?.length ? (
            <div className="side-card">
              <h4>Dlaczego tak napisane</h4>
              <ul className="reasons">
                {gen.explanation.map((x) => (
                  <li key={x}>
                    <Dot tone="accent" />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
              {gen.sources?.length ? (
                <details className="disclosure" style={{ marginTop: 12 }}>
                  <summary>Fakty i źródła ({gen.sources.length})</summary>
                  <div className="disclosure-body small">
                    {gen.sources.map((s) => (
                      <div key={s.label}>
                        {s.label}
                        {s.url ? (
                          <>
                            {" "}
                            <a href={s.url} target="_blank" rel="noopener noreferrer">
                              {hostOf(s.url)} <Ext size={10} />
                            </a>
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
              <p className="xsmall muted" style={{ marginTop: 10 }}>
                Szkic nie gwarantuje odpowiedzi ani sprzedaży. {gen.model ? `Model: ${gen.model}.` : ""}
              </p>
            </div>
          ) : null}

          {d.lint.length ? (
            <div className="side-card">
              <h4>Kontrola treści</h4>
              <ul className="reasons">
                {[...lintErrors, ...lintWarnings].map((l) => (
                  <li key={`${l.code}-${l.message}`}>
                    <Dot tone={l.level === "error" ? "bad" : "warn"} />
                    <span>
                      {l.message}
                      {l.excerpt ? <span className="muted"> „{l.excerpt}”</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!editable || m.status === "approved" ? (
            <SendPanel
              d={d}
              subject={subject}
              mailto={mailto}
              busy={busy}
              action={action}
              onSchedule={() => setScheduleOpen(true)}
              router={router}
            />
          ) : null}
        </aside>
      </div>

      <ReviewDialog
        open={review}
        onClose={() => setReview(false)}
        d={d}
        subject={subject}
        body={body}
        onApprove={async (ack) => {
          await flush();
          await action("approve", { acknowledgeWarnings: ack }, "Zatwierdzono tę wersję");
          setReview(false);
        }}
      />
      <Dialog
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        title="Wygenerować od nowa?"
        description="Szkic zawiera Twoje zmiany. Nowa wersja je zastąpi — obecna trafi do historii i możesz ją przywrócić."
        footer={
          <>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirmRegen(false)}>
              Anuluj
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setConfirmRegen(false);
                void generate(true);
              }}
            >
              Wygeneruj od nowa
            </button>
          </>
        }
      >
        <p className="small secondary">
          Wskazówka: zamiast generować całość, możesz użyć szybkich zmian albo przepisać tylko zaznaczony
          fragment.
        </p>
      </Dialog>
      <HistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        revisions={d.revisions}
        editable={editable}
        onRestore={async (rev) => {
          await action("restore", { rev }, `Przywrócono wersję ${rev}`);
          setHistoryOpen(false);
        }}
      />
      <ScheduleDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onSchedule={async (at) => {
          await action("schedule", { at }, "Zaplanowano");
          setScheduleOpen(false);
        }}
      />
    </div>
  );
}

function SendPanel({
  d,
  subject,
  mailto,
  busy,
  action,
  onSchedule,
  router,
}: {
  d: ComposerData;
  subject: string;
  mailto: string;
  busy: string | null;
  action: (path: string, body: Record<string, unknown>, msg: string, method?: string) => Promise<void>;
  onSchedule: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const toast = useToast();
  const m = d.message;
  const gmailReady = Boolean(d.gmail?.canSend && d.gmail.status === "connected");
  async function copy() {
    await navigator.clipboard.writeText(`${subject}\n\n${d.finalText}`);
    toast("Skopiowano temat i treść");
  }
  if (m.status === "sent") {
    return (
      <div className="side-card stack">
        <h4>Wysłana</h4>
        <p className="small">
          {formatWarsaw(m.sentAt)} · {m.sentVia === "manual" ? "oznaczona ręcznie" : "przyjęta przez Gmail"}
        </p>
        <p className="xsmall muted">„Wysłana” nie oznacza doręczenia ani przeczytania.</p>
        <div className="btn-group">
          {d.openInGmail ? (
            <a className="btn btn-sm" href={d.openInGmail} target="_blank" rel="noopener noreferrer">
              <Mail size={13} /> Otwórz w Gmailu
            </a>
          ) : null}
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              const r = await apiFetch<{ id: string }>(`/api/messages/${m.id}/follow-up`, { body: {} });
              router.push(`/wiadomosci/${r.id}`);
            }}
          >
            Przygotuj follow-up
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={async () => {
              await apiFetch(`/api/contacts/${m.contactId}/reply`, {
                body: { classification: "human_reply" },
              });
              toast("Zapisano odpowiedź");
            }}
          >
            Oznacz: odpowiedź otrzymana
          </button>
        </div>
      </div>
    );
  }
  if (m.status === "scheduled") {
    return (
      <div className="side-card stack">
        <h4>Zaplanowana</h4>
        <p className="small">{formatWarsaw(m.scheduledFor)}</p>
        <p className="xsmall muted">
          Wysyłka nastąpi w najbliższym cyklu harmonogramu po tej godzinie (zwykle do godziny później). Tuż
          przed wysyłką ponownie sprawdzamy wykluczenia i podstawę kontaktu.
        </p>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => action("schedule", {}, "Anulowano planowanie", "DELETE")}
        >
          Anuluj planowanie
        </button>
      </div>
    );
  }
  if (m.status !== "approved") return null;
  return (
    <div className="side-card stack">
      <h4>Wysyłka</h4>
      <p className="xsmall muted">
        Zatwierdzona wersja z {formatWarsaw(m.approval?.approvedAt)}. Każda zmiana treści, odbiorcy lub
        załączników cofa zatwierdzenie.
      </p>
      {gmailReady ? (
        <>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy !== null || !d.sendingEnabled}
            onClick={() => action("send", {}, "Wysłano przez Gmail")}
          >
            {busy === "send" ? <span className="spinner" /> : <Send size={14} />} Wyślij teraz z{" "}
            {d.gmail!.email}
          </button>
          <button type="button" className="btn" onClick={onSchedule} disabled={!d.sendingEnabled}>
            <Clock size={14} /> Zaplanuj…
          </button>
          {!d.sendingEnabled ? (
            <p className="xsmall muted">Wysyłka jest wyłączona w tym środowisku (SENDING_ENABLED).</p>
          ) : null}
        </>
      ) : (
        <p className="xsmall secondary">
          Gmail nie jest połączony — wyślij z własnej poczty i oznacz poniżej.{" "}
          <Link href="/ustawienia#gmail">Połącz Gmail</Link>, aby wysyłać jednym kliknięciem i śledzić
          odpowiedzi.
        </p>
      )}
      <div className="divider" style={{ margin: "4px 0" }} />
      <div className="btn-group">
        <button type="button" className="btn btn-sm" onClick={copy}>
          <Clipboard size={13} /> Kopiuj
        </button>
        <a className="btn btn-sm" href={mailto}>
          <Mail size={13} /> Otwórz w programie pocztowym
        </a>
      </div>
      {d.attachments.length ? (
        <p className="xsmall muted">
          Przy wysyłce z własnego programu dołącz plik(i) ręcznie:{" "}
          {d.attachments.map((a) => a.filename).join(", ")}.
        </p>
      ) : null}
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => action("mark-sent", {}, "Oznaczono jako wysłaną ręcznie")}
      >
        <Check size={13} /> Oznacz jako wysłaną ręcznie
      </button>
    </div>
  );
}

function ReviewDialog({
  open,
  onClose,
  d,
  subject,
  body,
  onApprove,
}: {
  open: boolean;
  onClose: () => void;
  d: ComposerData;
  subject: string;
  body: string;
  onApprove: (ack: boolean) => Promise<void>;
}) {
  const [ack, setAck] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the acknowledgement each time the dialog opens
  useEffect(() => setAck(false), [open]);
  const blockers = d.check.blockers;
  const warnings = d.check.warnings;
  const changed = subject !== d.message.subject || body !== d.message.body;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Przejrzyj przed zatwierdzeniem"
      description="Zatwierdzasz dokładnie tę wersję: odbiorcę, temat, treść z podpisem i załączniki."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Wróć do edycji
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={blockers.length > 0 || (warnings.length > 0 && !ack)}
            onClick={() => onApprove(ack)}
          >
            Zatwierdź tę wersję
          </button>
        </>
      }
    >
      {changed ? (
        <Callout tone="info">
          Masz niezapisane zmiany — zostaną zapisane przed zatwierdzeniem; podgląd poniżej odświeży się po
          zapisie.
        </Callout>
      ) : null}
      {blockers.length ? (
        <Callout tone="bad">
          <strong>Nie można zatwierdzić</strong>
          {blockers.map((b) => (
            <span key={b}>{b}</span>
          ))}
        </Callout>
      ) : null}
      <dl className="kv">
        <dt>Do</dt>
        <dd>{d.message.toEmail}</dd>
        <dt>Temat</dt>
        <dd>
          <strong>{subject}</strong>
        </dd>
        <dt>Załączniki</dt>
        <dd>
          {d.attachments.length
            ? d.attachments.map((a) => (
                <div key={a.versionId}>
                  <a
                    href={`/api/versions/${a.versionId}/file${a.mimeType === "application/pdf" ? "?inline=1" : ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {a.filename}
                  </a>{" "}
                  <span className="muted xsmall">
                    wersja {a.version} · {(a.sizeBytes / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
              ))
            : "brak"}
        </dd>
      </dl>
      <div className="preview-mail">{d.finalText}</div>
      {warnings.length ? (
        <div className="stack" style={{ gap: 8 }}>
          <Callout tone="warn">
            {warnings.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </Callout>
          <label className="check-row">
            <input
              type="checkbox"
              className="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            Rozumiem te ostrzeżenia i chcę zatwierdzić
          </label>
        </div>
      ) : null}
    </Dialog>
  );
}

function HistoryDialog({
  open,
  onClose,
  revisions,
  editable,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  revisions: ComposerData["revisions"];
  editable: boolean;
  onRestore: (rev: number) => Promise<void>;
}) {
  const [sel, setSel] = useState<number | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: preselect the latest revision each time the dialog opens
  useEffect(() => setSel(revisions[0]?.rev ?? null), [open, revisions]);
  const r = revisions.find((x) => x.rev === sel);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Historia wersji"
      wide
      description="Każde generowanie, szybka zmiana i Twoja edycja zostawia wersję. Przywrócenie też tworzy nową wersję."
    >
      {revisions.length === 0 ? (
        <p className="secondary small">Brak zapisanych wersji.</p>
      ) : (
        <div className="grid-2" style={{ gridTemplateColumns: "220px 1fr" }}>
          <div className="list">
            {revisions.map((x) => (
              <button
                key={x.rev}
                type="button"
                className="list-row"
                onClick={() => setSel(x.rev)}
                style={sel === x.rev ? { background: "var(--surface-selected)" } : undefined}
              >
                <div className="list-row-main">
                  <div className="small">
                    {x.rev}. {x.label ?? x.origin}
                  </div>
                  <div className="xsmall muted">{formatWarsaw(x.createdAt, "d LLL, HH:mm")}</div>
                </div>
              </button>
            ))}
          </div>
          {r ? (
            <div className="stack">
              <strong className="small">{r.subject}</strong>
              <div className="preview-mail">{r.body}</div>
              {editable ? (
                <div>
                  <button type="button" className="btn" onClick={() => onRestore(r.rev)}>
                    Przywróć tę wersję
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}

function ScheduleDialog({
  open,
  onClose,
  onSchedule,
}: {
  open: boolean;
  onClose: () => void;
  onSchedule: (at: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  useEffect(() => {
    if (open) {
      const t = new Date(Date.now() + 24 * 3_600_000);
      t.setHours(9, 0, 0, 0);
      setValue(new Date(t.getTime() - t.getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
    }
  }, [open]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Zaplanuj wysyłkę"
      description="Wysyłka nastąpi w pierwszym cyklu harmonogramu po tej godzinie (zwykle do godziny później)."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Anuluj
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSchedule(new Date(value).toISOString())}
            disabled={!value}
          >
            Zaplanuj
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">Data i godzina (czas lokalny przeglądarki)</span>
        <input
          className="input"
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
    </Dialog>
  );
}
