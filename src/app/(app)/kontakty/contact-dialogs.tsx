"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { Callout, Dialog } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";

type ImportReport = { rows: number; created: number; updated: number; unchanged: number; skipped: number; errors: string[] };

export function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts/import", { method: "POST", body: await file.text(), headers: { "content-type": "text/csv" } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import nie powiódł się");
      setReport(data);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import nie powiódł się");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        setReport(null);
        setFile(null);
        onClose();
      }}
      title="Import kontaktów z CSV"
      description="Kolumny rozpoznawane automatycznie: firma, domena, imię i nazwisko, stanowisko, e-mail, dział, źródło, notatka."
      footer={
        report ? (
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Gotowe
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-quiet" onClick={onClose}>
              Anuluj
            </button>
            <button type="button" className="btn btn-primary" disabled={!file || busy} onClick={run}>
              {busy ? <span className="spinner" /> : null} Importuj
            </button>
          </>
        )
      }
    >
      {report ? (
        <div className="stack">
          <p>
            Wierszy: {report.rows}. Nowych: <strong>{report.created}</strong>, zaktualizowanych: {report.updated}, bez zmian: {report.unchanged},
            pominiętych: {report.skipped}.
          </p>
          {report.errors.length ? (
            <details className="disclosure">
              <summary>Pominięte wiersze ({report.errors.length})</summary>
              <div className="disclosure-body small">{report.errors.map((e) => <div key={e}>{e}</div>)}</div>
            </details>
          ) : null}
          <p className="small secondary">
            Zaimportowane adresy mają status „Niesprawdzony”. Lista wykluczeń i wcześniej odrzucone kontakty są respektowane.
          </p>
        </div>
      ) : (
        <>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Plik CSV" />
          <Callout tone="info">
            Import nie nadaje uprawnienia do wysyłki. Podstawę kontaktu (np. zgodę) zapisujesz osobno przy kontakcie.
          </Callout>
          {error ? <Callout tone="bad">{error}</Callout> : null}
        </>
      )}
    </Dialog>
  );
}

type CompanyOption = { id: string; name: string; brand: string | null; domain: string };

export function AddContactDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [kind, setKind] = useState<"person" | "department_inbox" | "general_inbox">("person");
  const [form, setForm] = useState({ fullName: "", title: "", departmentLabel: "", email: "", sourceUrl: "", note: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      apiFetch<{ rows: CompanyOption[] }>(`/api/companies?limit=20&q=${encodeURIComponent(q)}`)
        .then((r) => setOptions(r.rows))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  async function submit() {
    setBusy(true);
    try {
      const r = await apiFetch<{ contactId: string }>("/api/contacts", {
        body: {
          companyId,
          kind,
          fullName: form.fullName || null,
          title: form.title || null,
          departmentLabel: form.departmentLabel || null,
          email: form.email || null,
          sourceUrl: form.sourceUrl || null,
          note: form.note || null,
        },
      });
      toast("Dodano kontakt");
      onClose();
      onDone(r.contactId);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie udało się dodać", "error");
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Dodaj kontakt"
      description="Kontakt dodany ręcznie ma pochodzenie „Wpisany ręcznie”. Podaj źródło, jeśli je masz."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Anuluj
          </button>
          <button type="button" className="btn btn-primary" disabled={!companyId || busy} onClick={submit}>
            Dodaj
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">Firma</span>
        <input className="input" placeholder="Szukaj firmy…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label="Wybierz firmę">
          <option value="">— wybierz —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.brand ?? o.name} ({o.domain})
            </option>
          ))}
        </select>
      </label>
      <div className="segmented" role="group" aria-label="Rodzaj kontaktu">
        {(
          [
            ["person", "Osoba"],
            ["department_inbox", "Skrzynka działu"],
            ["general_inbox", "Adres ogólny"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="field-row">
        {kind === "person" ? (
          <label className="field">
            <span className="field-label">Imię i nazwisko</span>
            <input className="input" value={form.fullName} onChange={set("fullName")} />
          </label>
        ) : (
          <label className="field">
            <span className="field-label">Dział</span>
            <input className="input" value={form.departmentLabel} onChange={set("departmentLabel")} placeholder="np. Dział Szkoleń" />
          </label>
        )}
        <label className="field">
          <span className="field-label">Stanowisko</span>
          <input className="input" value={form.title} onChange={set("title")} />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span className="field-label">E-mail</span>
          <input className="input" type="email" value={form.email} onChange={set("email")} />
        </label>
        <label className="field">
          <span className="field-label">Źródło (URL)</span>
          <input className="input" type="url" value={form.sourceUrl} onChange={set("sourceUrl")} />
        </label>
      </div>
      <label className="field">
        <span className="field-label">Notatka</span>
        <textarea className="textarea" value={form.note} onChange={set("note")} rows={2} />
      </label>
    </Dialog>
  );
}
