"use client";

import { MailPlus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Callout, Empty } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";

type Program = { id: string; name: string; status: string };

/** Step before the composer: choose programme and language (explicit for every message or batch). */
export function NewDraft() {
  const sp = useSearchParams();
  const router = useRouter();
  const single = sp.get("contact");
  const many = sp.get("contacts")?.split(",").filter(Boolean) ?? [];
  const ids = single ? [single] : many;
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [programId, setProgramId] = useState<string>("");
  const [language, setLanguage] = useState<"pl" | "en">("pl");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ messageId: string }[]>([]);
  const [ai, setAi] = useState(true);

  useEffect(() => {
    apiFetch<{ programs: Program[]; ai: boolean }>("/api/materials")
      .then((r) => {
        const approved = r.programs.filter((p) => p.status === "approved");
        setPrograms(approved);
        setAi(r.ai);
        if (approved[0]) setProgramId(approved[0].id);
      })
      .catch(() => setPrograms([]));
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      if (ids.length === 1) {
        const r = await apiFetch<{ id: string }>("/api/messages", {
          body: { contactId: ids[0], programId: programId || null, language },
        });
        if (ai) await apiFetch(`/api/messages/${r.id}/generate`, { body: {} }).catch(() => null);
        router.replace(`/wiadomosci/${r.id}`);
        return;
      }
      const b = await apiFetch<{
        created: { contactId: string; messageId: string }[];
        skipped: { contactId: string; reason: string }[];
      }>("/api/batches", { body: { contactIds: ids, programId: programId || null, language } });
      setCreated(b.created);
      const failed = b.skipped.map((s) => s.reason);
      setProgress({ done: 0, total: b.created.length, failed });
      if (ai) {
        for (const [i, c] of b.created.entries()) {
          try {
            await apiFetch(`/api/messages/${c.messageId}/generate`, { body: {} });
          } catch (e) {
            failed.push(e instanceof ApiError ? e.message : "Błąd generowania");
          }
          setProgress({ done: i + 1, total: b.created.length, failed: [...failed] });
        }
      } else setProgress({ done: b.created.length, total: b.created.length, failed });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Nie udało się utworzyć szkicu");
    } finally {
      setBusy(false);
    }
  }

  if (ids.length === 0)
    return (
      <div className="empty-page">
        <h1 className="sr-only">Nowa wiadomość</h1>
        <Empty
          icon={<MailPlus size={28} strokeWidth={1.5} />}
          title="Najpierw wybierz, do kogo piszesz"
          actions={
            <Link href="/kontakty" className="btn btn-primary">
              Przejdź do kontaktów
            </Link>
          }
        >
          Otwórz kontakt i kliknij „Przygotuj email”, albo zaznacz kilka kontaktów, aby przygotować szkice dla
          wszystkich naraz.
        </Empty>
      </div>
    );

  return (
    <div className="stack-lg">
      <header>
        <h1>{ids.length === 1 ? "Nowa wiadomość" : `Szkice dla ${ids.length} kontaktów`}</h1>
        <p className="secondary" style={{ marginTop: 6 }}>
          {ids.length === 1
            ? "Wybierz program i język. Szkic powstanie na podstawie zatwierdzonych materiałów i roli odbiorcy."
            : "Każdy kontakt dostanie osobny, indywidualny szkic — nigdy jedną wspólną wiadomość. Każdy przejrzysz i zatwierdzisz osobno."}
        </p>
      </header>
      {!ai ? (
        <Callout tone="info">
          Generowanie AI nie jest skonfigurowane (ANTHROPIC_API_KEY). Utworzę puste szkice, które możesz
          napisać samodzielnie.
        </Callout>
      ) : null}
      {programs && programs.length === 0 ? (
        <Callout tone="warn">
          <span>
            Nie masz jeszcze zatwierdzonego programu. Szkic powstanie bez opisu oferty — lepiej najpierw
            zatwierdzić program w <Link href="/materialy">Materiałach</Link>.
          </span>
        </Callout>
      ) : null}
      {!progress ? (
        <div className="card card-pad stack">
          <label className="field">
            <span className="field-label">Program</span>
            <select className="select" value={programId} onChange={(e) => setProgramId(e.target.value)}>
              <option value="">Bez programu (ogólne przedstawienie)</option>
              {programs?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span className="field-label">Język wiadomości</span>
            <fieldset className="segmented" aria-label="Język">
              <button type="button" aria-pressed={language === "pl"} onClick={() => setLanguage("pl")}>
                Polski
              </button>
              <button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>
                English
              </button>
            </fieldset>
          </div>
          {error ? <Callout tone="bad">{error}</Callout> : null}
          <div className="btn-group">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={start}
              disabled={busy || !programs}
            >
              {busy ? <span className="spinner" /> : null} {ai ? "Przygotuj szkic" : "Utwórz szkic"}
              {ids.length > 1 ? "e" : ""}
            </button>
            <button type="button" className="btn btn-quiet btn-lg" onClick={() => router.back()}>
              Anuluj
            </button>
          </div>
          {busy && ids.length === 1 ? (
            <p className="small secondary">Piszę szkic — zwykle kilkanaście sekund…</p>
          ) : null}
        </div>
      ) : (
        <div className="card card-pad stack">
          <div className="row-between">
            <strong>
              {progress.done} z {progress.total} szkiców gotowych
            </strong>
            {busy ? <span className="spinner" /> : null}
          </div>
          <div className="bar">
            <span
              style={{
                width: `${progress.total ? (100 * progress.done) / progress.total : 100}%`,
                background: "var(--accent)",
              }}
            />
          </div>
          {progress.failed.length ? (
            <Callout tone="warn">
              <strong>Pominięte lub nieudane: {progress.failed.length}</strong>
              {progress.failed.slice(0, 8).map((f) => (
                <span key={f}>{f}</span>
              ))}
            </Callout>
          ) : null}
          <div className="btn-group">
            <Link className="btn btn-primary" href="/wiadomosci?box=drafts">
              Przejdź do szkiców
            </Link>
            {created[0] ? (
              <Link className="btn" href={`/wiadomosci/${created[0].messageId}`}>
                Otwórz pierwszy
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
