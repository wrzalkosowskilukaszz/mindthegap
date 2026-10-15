"use client";

import { Check, Copy, Download, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { Callout, Dialog } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { WRITTEN_IN } from "@/lib/jobs/match";
import { splitTailored } from "@/lib/jobs/tailor";
import type { TailoredCv } from "@/server/careers/service";

/**
 * CV tailored to one offer, for free: the app checks the offer's keywords against the CV and prepares a
 * prompt; the owner runs it in ChatGPT or Claude, pastes the answer back and downloads a Word file.
 */
export function TailorDialog({
  id,
  title,
  company,
  open,
  onClose,
  onSaved,
}: {
  id: string;
  title: string;
  company: string;
  open: boolean;
  onClose: () => void;
  onSaved: (savedAt: string | null) => void;
}) {
  const toast = useToast();
  const [d, setD] = useState<TailoredCv | null>(null);
  const [text, setText] = useState("");
  const [state, setState] = useState<"saved" | "pending">("saved");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef("");

  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    try {
      const r = await apiFetch<{ savedAt: string | null }>(`/api/jobs/${id}/tailored`, {
        method: "PUT",
        body: { text: textRef.current },
      });
      setState("saved");
      onSaved(r.savedAt);
    } catch {
      toast("Nie zapisano CV", "error");
    }
  }, [id, toast, onSaved]);

  useEffect(() => {
    if (!open) return;
    setD(null);
    setCopied(false);
    apiFetch<TailoredCv>(`/api/jobs/${id}/tailored`)
      .then((x) => {
        setD(x);
        setText(x.text);
        textRef.current = x.text;
        setState("saved");
      })
      .catch(() => toast("Nie udało się wczytać", "error"));
  }, [open, id, toast]);

  // Closing (also with Esc, or the panel going away) saves a paste that is still waiting.
  useEffect(
    () => () => {
      if (timer.current) void save();
    },
    [save],
  );
  function close() {
    if (timer.current) void save();
    onClose();
  }

  async function copyPrompt() {
    try {
      const r = await apiFetch<{ prompt: string }>(`/api/jobs/${id}/tailored/prompt`, { body: {} });
      await navigator.clipboard.writeText(r.prompt);
      setCopied(true);
      toast("Skopiowano. Wklej polecenie w ChatGPT lub Claude.");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie skopiowano", "error");
    }
  }

  const { cv, checks } = splitTailored(text);
  async function copyCv() {
    await navigator.clipboard.writeText(cv);
    toast("Skopiowano CV");
  }
  async function download() {
    if (timer.current || state === "pending") await save();
    window.location.assign(`/api/jobs/${id}/tailored/docx`);
  }

  const lang = d?.language ? WRITTEN_IN[d.language] : null;
  return (
    <Dialog
      open={open}
      onClose={close}
      wide
      title="Dopasuj CV do oferty"
      description={`${title} · ${company}`}
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={close}>
            Zamknij
          </button>
          {cv ? (
            <button type="button" className="btn" onClick={copyCv}>
              <Copy size={14} /> Kopiuj CV
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={download} disabled={!cv}>
            <Download size={14} /> Pobierz Word (.docx)
          </button>
        </>
      }
    >
      {!d ? (
        <div className="stack">
          {[70, 90, 60].map((w) => (
            <span key={w} className="skeleton" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : !d.hasCv ? (
        <Callout tone="info">
          <span>
            Najpierw wgraj swoje CV w karcie „Twoje CV” na górze strony. Bez niego nie ma czego dopasować.
          </span>
        </Callout>
      ) : (
        <div className="stack-lg">
          <section className="stack" style={{ gap: 8 }}>
            <h4 className="section-title" style={{ margin: 0 }}>
              Słowa kluczowe z oferty
            </h4>
            {d.gap.inCv.length + d.gap.missing.length === 0 ? (
              <p className="small muted">
                W tej ofercie nie ma typowych słów z Twojej branży. Polecenie i tak dopasuje CV do całego
                opisu.
              </p>
            ) : (
              <>
                {d.gap.missing.length ? (
                  <div className="stack" style={{ gap: 6 }}>
                    <span className="xsmall muted">Nie widać ich w Twoim CV</span>
                    <div className="job-reasons">
                      {d.gap.missing.map((w) => (
                        <span key={w} className="reason reason-warn">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {d.gap.inCv.length ? (
                  <div className="stack" style={{ gap: 6 }}>
                    <span className="xsmall muted">Masz je w CV</span>
                    <div className="job-reasons">
                      {d.gap.inCv.map((w) => (
                        <span key={w} className="reason reason-good">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <p className="xsmall muted">
                  Brakujące dopisz tylko wtedy, gdy naprawdę masz to doświadczenie, najlepiej słowami z
                  oferty.
                </p>
              </>
            )}
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <h4 className="section-title" style={{ margin: 0 }}>
              1. Skopiuj polecenie
            </h4>
            <p className="small secondary" style={{ margin: 0 }}>
              Polecenie zawiera ofertę i Twoje CV{d.cvFilename ? ` (${d.cvFilename})` : ""}. CV powstanie{" "}
              {lang ?? "w języku oferty"}. Polecenie zabrania dopisywania czegokolwiek, czego nie ma w Twoim
              CV. Darmowe wersje ChatGPT i Claude wystarczą.
            </p>
            <div className="btn-group">
              <button type="button" className="btn btn-primary btn-sm" onClick={copyPrompt}>
                {copied ? <Check size={13} /> : <Copy size={13} />}{" "}
                {copied ? "Skopiowano" : "Kopiuj polecenie"}
              </button>
              <a
                className="btn btn-quiet btn-sm"
                href="https://chatgpt.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                ChatGPT <ExternalLink size={12} />
              </a>
              <a
                className="btn btn-quiet btn-sm"
                href="https://claude.ai/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                Claude <ExternalLink size={12} />
              </a>
            </div>
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <h4 className="section-title" style={{ margin: 0 }}>
              2. Wklej odpowiedź
              <span className="xsmall muted" aria-live="polite" style={{ fontWeight: 400 }}>
                {state === "pending" ? "Zapisywanie…" : text ? "Zapisano przy tej ofercie" : ""}
              </span>
            </h4>
            <textarea
              className="textarea"
              rows={10}
              value={text}
              aria-label="CV dopasowane do oferty"
              onChange={(e) => {
                setText(e.target.value);
                textRef.current = e.target.value;
                setState("pending");
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => void save(), 800);
              }}
              placeholder="Wklej tu całą odpowiedź z ChatGPT lub Claude…"
            />
            <p className="xsmall muted" style={{ margin: 0 }}>
              Część „Do sprawdzenia” nie trafi do pliku Word.
            </p>
          </section>

          {checks.length ? (
            <Callout>
              <strong>Sprawdź przed wysłaniem</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {checks.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Callout>
          ) : null}
          {cv ? (
            <p className="xsmall muted" style={{ margin: 0 }}>
              Przeczytaj całe CV przed wysłaniem i upewnij się, że wszystko w nim jest prawdą. AI czasem coś
              dopisuje mimo zakazu.
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
