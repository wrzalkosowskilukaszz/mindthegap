"use client";

import {
  ArrowLeft,
  Check,
  Clipboard,
  Clock,
  Copy,
  ExternalLink as Ext,
  FileText,
  History,
  Mail,
  Paperclip,
  PenLine,
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
import { type SignatureFields, signatureFor } from "@/lib/signature";
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
  const [signatureOpen, setSignatureOpen] = useState(false);
  const revision = useRef(0);
  const salutationRef = useRef<Salutation>("neutral");
  const revertProgram = useRef<string | null | undefined>(undefined);
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
      setError(
        e instanceof ApiError && e.status === 404
          ? "Ta wiadomość nie istnieje — mogła zostać usunięta."
          : e instanceof ApiError
            ? e.message
            : "Nie udało się wczytać wiadomości",
      );
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const editable = d ? ["draft", "approved", "failed"].includes(d.message.status) : false;
  // Without Gmail there is no approval step: copy or open in your mail app, then press "Wysłane".
  const gmailReady = Boolean(d?.gmail?.canSend && d.gmail.status === "connected");

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
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && editable && gmailReady) {
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
  }, [persist, editable, gmailReady, save]);

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
        body: { overwrite, salutation: salutationRef.current },
      });
      revertProgram.current = undefined;
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

  /** "Cancel" in the regenerate question: put the previous service back, so text and choice agree. */
  async function cancelRegen() {
    setConfirmRegen(false);
    if (revertProgram.current !== undefined) {
      await persist({ programId: revertProgram.current });
      revertProgram.current = undefined;
      await load();
    }
  }

  async function copyPrompt() {
    await flush();
    try {
      const r = await apiFetch<{ prompt: string }>(`/api/messages/${id}/prompt`, { body: { salutation } });
      await navigator.clipboard.writeText(r.prompt);
      toast("Skopiowano. Wklej w ChatGPT lub Claude, a odpowiedź wklej tutaj jako treść.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie udało się skopiować", "error");
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

  /** Saves pending edits and returns the current text exactly as it will be sent (with the footer). */
  async function fresh(): Promise<ComposerData> {
    await flush();
    const data = await apiFetch<ComposerData>(`/api/messages/${id}`);
    setD(data);
    return data;
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
              className="btn btn-quiet"
              onClick={async () => {
                if (!window.confirm("Usunąć ten szkic? Tego nie można cofnąć.")) return;
                await apiFetch(`/api/messages/${id}`, { method: "DELETE" });
                toast("Usunięto szkic");
                router.push("/wiadomosci");
              }}
            >
              <X size={15} /> Usuń szkic
            </button>
          ) : null}
          {editable && gmailReady ? (
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
                    : "Wypełnij szkic gotowym szablonem dopasowanym do działu odbiorcy (bez kosztów), albo skopiuj polecenie do darmowego ChatGPT lub Claude i wklej odpowiedź."}
                </p>
                <div className="btn-group">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => generate(false)}
                    disabled={busy !== null}
                  >
                    {busy === "generate" ? <span className="spinner" /> : <Sparkles size={15} />}{" "}
                    {d.ai ? "Wygeneruj szkic" : "Wypełnij z szablonu"}
                  </button>
                  <button type="button" className="btn" onClick={copyPrompt} disabled={busy !== null}>
                    <Copy size={14} /> Kopiuj polecenie do ChatGPT / Claude
                  </button>
                </div>
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
            {!empty ? (
              <div className="signature-block">
                <div className="signature-head">
                  <span>Podpis — dodawany automatycznie</span>
                  {editable ? (
                    <button
                      type="button"
                      className="link-button small"
                      onClick={() => setSignatureOpen(true)}
                    >
                      <PenLine size={13} /> Edytuj podpis
                    </button>
                  ) : null}
                </div>
                {d.tail.signature ? (
                  <div className="signature-text">{d.tail.signature}</div>
                ) : (
                  <p className="small muted">
                    Brak podpisu. Dodaj imię, stanowisko i firmę — pojawią się pod każdym mailem.
                  </p>
                )}
                {d.tail.footer ? <div className="signature-footer">— {d.tail.footer}</div> : null}
              </div>
            ) : null}
            {editable && !d.ai && !empty ? (
              <div className="quick-actions" role="toolbar" aria-label="Szablon i polecenie">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={busy !== null}
                  onClick={() => generate(false)}
                >
                  {busy === "generate" ? <span className="spinner" /> : <Sparkles size={13} />} Wypełnij
                  ponownie z szablonu
                </button>
                <button type="button" className="btn btn-sm" disabled={busy !== null} onClick={copyPrompt}>
                  <Copy size={13} /> Kopiuj polecenie do ChatGPT / Claude
                </button>
              </div>
            ) : null}
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
        </div>

        <aside className="side-stack">
          {!editable || m.status === "approved" || (!gmailReady && !empty) ? (
            <SendPanel
              d={d}
              busy={busy}
              action={action}
              fresh={fresh}
              reload={load}
              onSchedule={() => setScheduleOpen(true)}
              router={router}
            />
          ) : null}
          {editable ? (
            <div className="side-card stack">
              <h4>Usługa i język</h4>
              <select
                className="select"
                value={m.programId ?? ""}
                onChange={async (e) => {
                  await flush();
                  revertProgram.current = m.programId;
                  await persist({ programId: e.target.value || null });
                  await load();
                  // Refresh the text right away; if you edited it, you are asked first.
                  await generate(false);
                }}
                aria-label="Program"
              >
                <option value="">Bez konkretnej usługi</option>
                {d.programs
                  .filter((p) => p.status !== "archived" || p.id === m.programId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
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
                        await generate(false);
                      }}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </fieldset>
                {m.language === "pl" ? (
                  <select
                    className="select"
                    style={{ width: 180 }}
                    value={salutation}
                    onChange={(e) => {
                      setSalutation(e.target.value as Salutation);
                      salutationRef.current = e.target.value as Salutation;
                      void generate(false);
                    }}
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
                  Aplikacja nie zgaduje płci odbiorcy. Formę „Pani/Pan” wybierasz ręcznie.
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
                Szkic nie gwarantuje odpowiedzi ani sprzedaży.
                {gen.model && !gen.model.startsWith("template") ? ` Model AI: ${gen.model}.` : ""}
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
        onClose={cancelRegen}
        title="Wygenerować od nowa?"
        description="Szkic zawiera Twoje zmiany. Nowa wersja je zastąpi — obecna trafi do historii i możesz ją przywrócić."
        footer={
          <>
            <button type="button" className="btn btn-quiet" onClick={cancelRegen}>
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
      <SignatureDialog
        open={signatureOpen}
        language={m.language as "pl" | "en"}
        onClose={() => setSignatureOpen(false)}
        onSaved={async () => {
          setSignatureOpen(false);
          await load();
          toast("Zapisano podpis");
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
  busy,
  action,
  fresh,
  reload,
  onSchedule,
  router,
}: {
  d: ComposerData;
  busy: string | null;
  action: (path: string, body: Record<string, unknown>, msg: string, method?: string) => Promise<void>;
  fresh: () => Promise<ComposerData>;
  reload: () => Promise<void>;
  onSchedule: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const toast = useToast();
  const m = d.message;
  const gmailReady = Boolean(d.gmail?.canSend && d.gmail.status === "connected");
  async function copy(part: "subject" | "body") {
    const x = await fresh();
    await navigator.clipboard.writeText(part === "subject" ? x.message.subject : x.finalText);
    toast(part === "subject" ? "Skopiowano temat" : "Skopiowano treść z podpisem");
  }
  async function openMail() {
    const x = await fresh();
    window.location.href = `mailto:${encodeURIComponent(x.message.toEmail ?? "")}?subject=${encodeURIComponent(x.message.subject)}&body=${encodeURIComponent(x.finalText)}`;
  }
  const replied = Boolean(
    d.contact?.inbound.some(
      (i) =>
        i.classification === "human_reply" && m.sentAt && Date.parse(i.receivedAt) >= Date.parse(m.sentAt),
    ),
  );
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
          {replied ? null : (
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
          )}
          {replied ? (
            <span className="tag tag-ok">Jest odpowiedź</span>
          ) : (
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={async () => {
                await apiFetch(`/api/contacts/${m.contactId}/reply`, {
                  body: { classification: "human_reply" },
                });
                toast("Zapisano: jest odpowiedź. Przypomnienie o follow-upie wyłączone.");
                await reload();
              }}
            >
              Oznacz: odpowiedź otrzymana
            </button>
          )}
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
  if (gmailReady && m.status === "approved") {
    return (
      <div className="side-card stack">
        <h4>Wysyłka</h4>
        <p className="xsmall muted">
          Zatwierdzona wersja z {formatWarsaw(m.approval?.approvedAt)}. Każda zmiana treści, odbiorcy lub
          załączników cofa zatwierdzenie.
        </p>
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
      </div>
    );
  }
  if (gmailReady || !["draft", "failed", "approved"].includes(m.status)) return null;

  // Without Gmail: send from your own mailbox, then record it here with one click.
  const blockers = d.check.blockers;
  const needsBasis = blockers.some((b) => b.startsWith("Brak udokumentowanej podstawy"));
  const otherBlockers = blockers.filter((b) => !b.startsWith("Brak udokumentowanej podstawy"));
  const blocked = blockers.length > 0;
  return (
    <div className="side-card stack">
      <h4>Wyślij ze swojej poczty</h4>
      {needsBasis && d.contact ? <BasisQuestion d={d} onSaved={reload} /> : null}
      {otherBlockers.length ? (
        <Callout tone="bad">
          <strong>Zanim wyślesz</strong>
          {otherBlockers.map((b) => (
            <span key={b}>{b}</span>
          ))}
        </Callout>
      ) : null}
      {!blocked && d.check.warnings.length ? (
        <ul className="reasons xsmall">
          {d.check.warnings.map((w) => (
            <li key={w}>
              <Dot tone="warn" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <ol className="send-steps small">
        <li>Skopiuj tekst albo otwórz go w poczcie.</li>
        <li>Wyślij ze swojej skrzynki.</li>
        <li>Wróć tutaj i kliknij „Wysłane” — przypomnimy Ci o follow-upie.</li>
      </ol>
      <div className="btn-group">
        <button type="button" className="btn btn-sm" onClick={() => copy("subject")} disabled={blocked}>
          <Clipboard size={13} /> Kopiuj temat
        </button>
        <button type="button" className="btn btn-sm" onClick={() => copy("body")} disabled={blocked}>
          <Clipboard size={13} /> Kopiuj treść
        </button>
        <button type="button" className="btn btn-sm" onClick={openMail} disabled={blocked}>
          <Mail size={13} /> Otwórz w poczcie
        </button>
      </div>
      {d.attachments.length ? (
        <p className="xsmall muted">Dołącz w poczcie: {d.attachments.map((a) => a.filename).join(", ")}.</p>
      ) : null}
      <button
        type="button"
        className="btn btn-primary"
        disabled={blocked || busy !== null}
        onClick={() => action("mark-sent", {}, "Zapisano jako wysłaną")}
      >
        {busy === "mark-sent" ? <span className="spinner" /> : <Check size={14} />} Wysłane
      </button>
    </div>
  );
}

/**
 * Asks, in plain words, why this recipient may receive an offer by email (Art. 398 PKE requires the
 * recipient's consent, also between companies). One click when the company's own page invites offers
 * to this address; otherwise a short note. The owner decides; the app only records it.
 */
function BasisQuestion({ d, onSaved }: { d: ComposerData; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const contact = d.contact!;
  const invitation = contact.evidence.find((e) => e.supports.includes("invitation") && e.url);
  const [choice, setChoice] = useState<"consent" | "prior_relationship" | "invitation_to_offer">("consent");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(body: Record<string, unknown>) {
    setSaving(true);
    try {
      await apiFetch(`/api/contacts/${contact.contact.id}/eligibility`, { body });
      toast("Zapisano. Możesz wysyłać.");
      await onSaved();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie zapisano", "error");
    } finally {
      setSaving(false);
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const isUrl = /^https?:\/\/\S+$/.test(note.trim());
  return (
    <div className="basis-question stack">
      <p className="small">
        <strong>Skąd wiesz, że możesz tu napisać?</strong> Polskie prawo pozwala wysłać ofertę e-mailem tylko
        za zgodą odbiorcy — także do firm (art. 398 Prawa komunikacji elektronicznej).
      </p>
      {invitation ? (
        <div className="stack" style={{ gap: 6 }}>
          <p className="xsmall secondary">
            Strona firmy zaprasza do wysyłania ofert na ten adres
            {invitation.quote ? <>: „{invitation.quote}”</> : null}{" "}
            <a href={invitation.url!} target="_blank" rel="noopener noreferrer">
              {hostOf(invitation.url!)} <Ext size={10} />
            </a>
          </p>
          <button
            type="button"
            className="btn btn-sm"
            disabled={saving}
            onClick={() =>
              save({
                basis: "invitation_to_offer",
                evidence: invitation.quote ?? "Zaproszenie do składania ofert na stronie firmy",
                evidenceUrl: invitation.url,
                scope: "Oferta usług szkoleniowych na adres wskazany na stronie",
                date: (invitation.sourcePublishedAt ?? invitation.observedAt).slice(0, 10),
              })
            }
          >
            <Check size={13} /> Tak, piszę w odpowiedzi na to zaproszenie
          </button>
        </div>
      ) : null}
      <fieldset className="stack" style={{ gap: 4, border: 0, padding: 0, margin: 0 }}>
        <legend className="xsmall secondary">{invitation ? "Albo:" : "Zaznacz:"}</legend>
        {(
          [
            ["consent", "Ta osoba lub firma zgodziła się na kontakt"],
            ["prior_relationship", "Sama zapytała o moją ofertę"],
            ["invitation_to_offer", "Firma zaprasza do ofert na ten adres"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="check-row small">
            <input type="radio" name="basis" checked={choice === value} onChange={() => setChoice(value)} />
            {label}
          </label>
        ))}
      </fieldset>
      <input
        className="input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={
          choice === "invitation_to_offer"
            ? "Link do strony z zaproszeniem"
            : "Kiedy i jak? np. „rozmowa na targach, 10.10”"
        }
        aria-label="Kiedy i jak"
      />
      <button
        type="button"
        className="btn btn-sm"
        disabled={saving || !note.trim()}
        onClick={() =>
          save({
            basis: choice,
            evidence: isUrl ? null : note.trim(),
            evidenceUrl: isUrl ? note.trim() : null,
            date: today,
          })
        }
      >
        Zapisz
      </button>
      <p className="xsmall muted">
        Żadne nie pasuje? Wtedy lepiej nie wysyłać oferty — grozi za to kara UKE. To nie jest porada prawna.
      </p>
    </div>
  );
}

/** Name, position and company for the signature, edited right where the email is written. */
function SignatureDialog({
  open,
  language,
  onClose,
  onSaved,
}: {
  open: boolean;
  language: "pl" | "en";
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [p, setP] = useState<(SignatureFields & Record<string, unknown>) | null>(null);
  const [own, setOwn] = useState(false);
  const ownKey = language === "pl" ? "signaturePl" : "signatureEn";
  useEffect(() => {
    if (!open) return;
    setP(null);
    apiFetch<SignatureFields & Record<string, unknown>>("/api/settings/profile")
      .then((x) => {
        setP(x);
        setOwn(Boolean(x[ownKey].trim()));
      })
      .catch(() => toast("Nie udało się wczytać profilu", "error"));
  }, [open, ownKey, toast]);
  const set = (k: keyof SignatureFields, v: string) => setP((x) => (x ? { ...x, [k]: v } : x));
  async function save() {
    if (!p) return;
    try {
      await apiFetch("/api/settings/profile", { method: "PUT", body: own ? p : { ...p, [ownKey]: "" } });
      await onSaved();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie zapisano", "error");
    }
  }
  const preview = p ? signatureFor(own ? p : { ...p, [ownKey]: "" }, language).text : "";
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Twój podpis"
      description="Pojawi się pod każdym mailem. Zmiana dotyczy też szkiców, które już masz."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Anuluj
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!p}>
            Zapisz podpis
          </button>
        </>
      }
    >
      {!p ? (
        <span className="skeleton" style={{ width: "60%" }} />
      ) : (
        <>
          <div className="field-row">
            <label className="field">
              <span className="field-label">Imię i nazwisko</span>
              <input
                className="input"
                value={p.senderName}
                onChange={(e) => set("senderName", e.target.value)}
                placeholder="np. Julia Krasniuk"
              />
            </label>
            {language === "en" ? (
              <label className="field">
                <span className="field-label">Stanowisko (po angielsku)</span>
                <input
                  className="input"
                  value={p.senderRoleEn ?? ""}
                  onChange={(e) => set("senderRoleEn", e.target.value)}
                  placeholder="e.g. Trainer and facilitator"
                />
              </label>
            ) : (
              <label className="field">
                <span className="field-label">Stanowisko</span>
                <input
                  className="input"
                  value={p.senderRole}
                  onChange={(e) => set("senderRole", e.target.value)}
                  placeholder="np. Trenerka i facylitatorka"
                />
              </label>
            )}
          </div>
          <div className="field-row">
            <label className="field">
              <span className="field-label">Firma</span>
              <input
                className="input"
                value={p.businessName}
                onChange={(e) => set("businessName", e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Strona www</span>
              <input className="input" value={p.website} onChange={(e) => set("website", e.target.value)} />
            </label>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              className="checkbox"
              checked={own}
              onChange={(e) => setOwn(e.target.checked)}
            />
            Własny podpis zamiast powyższego ({language.toUpperCase()})
          </label>
          {own ? (
            <textarea
              className="textarea"
              rows={4}
              value={p[ownKey]}
              onChange={(e) => set(ownKey, e.target.value)}
              aria-label="Własny podpis"
            />
          ) : null}
          <div className="stack" style={{ gap: 6 }}>
            <span className="field-label">Tak będzie wyglądać</span>
            <div className="signature-text signature-preview">{preview || "—"}</div>
          </div>
        </>
      )}
    </Dialog>
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
