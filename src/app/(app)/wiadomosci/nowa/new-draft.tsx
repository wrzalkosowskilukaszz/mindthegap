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
  const [who, setWho] = useState<string | null>(null);

  // Show who the message is for.
  const onlyId = ids.length === 1 ? ids[0] : null;
  useEffect(() => {
    if (!onlyId) return;
    apiFetch<{
      contact: {
        fullName: string | null;
        departmentLabel: string | null;
        email: string | null;
        title: string | null;
      };
      company: { name: string; brand: string | null } | null;
    }>(`/api/contacts/${onlyId}`)
      .then((d) => {
        const c = d.contact;
        const name = c.fullName ?? c.departmentLabel ?? c.email ?? "";
        setWho(
          [name, c.fullName ? c.title : null, d.company?.brand ?? d.company?.name]
            .filter(Boolean)
            .join(" · "),
        );
      })
      .catch(() => setWho(null));
  }, [onlyId]);

  useEffect(() => {
    apiFetch<{ programs: Program[]; ai: boolean }>("/api/materials")
      .then((r) => {
        const usable = r.programs.filter((p) => p.status !== "archived");
        setPrograms(usable);
        setAi(r.ai);
        if (usable[0]) setProgramId(usable[0].id);
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
        await apiFetch(`/api/messages/${r.id}/generate`, { body: {} }).catch(() => null);
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
      for (const [i, c] of b.created.entries()) {
        try {
          await apiFetch(`/api/messages/${c.messageId}/generate`, { body: {} });
        } catch (e) {
          failed.push(e instanceof ApiError ? e.message : "Błąd generowania");
        }
        setProgress({ done: i + 1, total: b.created.length, failed: [...failed] });
      }
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
        {who ? <p style={{ marginTop: 6, fontWeight: 600 }}>Do: {who}</p> : null}
        <p className="secondary" style={{ marginTop: 6 }}>
          {ids.length === 1
            ? "Wybierz usługę, o której chcesz napisać, i język. Tekst dopasuje się do działu odbiorcy."
            : "Każdy kontakt dostanie osobny szkic, dopasowany do swojego działu — nie jedną wspólną wiadomość."}
        </p>
      </header>
      {!ai ? (
        <Callout tone="info">
          Szkice powstaną z gotowych szablonów dopasowanych do działu odbiorcy i wybranego programu — bez
          kosztów i bez AI. Przeczytaj każdy przed wysłaniem.
        </Callout>
      ) : null}

      {!progress ? (
        <div className="card card-pad stack">
          <label className="field">
            <span className="field-label">Usługa</span>
            <select className="select" value={programId} onChange={(e) => setProgramId(e.target.value)}>
              <option value="">Ogólnie o mojej pracy</option>
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
              {busy ? <span className="spinner" /> : null} Przygotuj szkic
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
