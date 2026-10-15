"use client";

import { Inbox } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { Dot, Empty, SkeletonRows } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api-client";
import { formatWarsaw } from "@/lib/time";

const BOXES = [
  { id: "drafts", label: "Szkice" },
  { id: "scheduled", label: "Zaplanowane" },
  { id: "sent", label: "Wysłane" },
  { id: "replies", label: "Odpowiedzi" },
  { id: "problems", label: "Problemy" },
] as const;
type Box = (typeof BOXES)[number]["id"];

type MsgRow = {
  id: string;
  subject: string;
  status: string;
  language: string;
  kind: string;
  updatedAt: string;
  scheduledFor: string | null;
  sentAt: string | null;
  sendError: string | null;
  contactId: string;
  who: string;
  toEmail: string | null;
  outreachStatus: string;
  companyName: string;
  programName: string | null;
};
type ReplyRow = {
  id: string;
  receivedAt: string;
  classification: string;
  fromEmail: string | null;
  subject: string | null;
  contactId: string | null;
  who: string | null;
  companyName: string | null;
  messageId: string | null;
};

const EMPTY: Record<Box, { title: string; text: string }> = {
  drafts: {
    title: "Brak szkiców",
    text: "Otwórz kontakt i wybierz „Przygotuj email”, albo zaznacz kilka kontaktów i przygotuj szkice zbiorczo.",
  },
  scheduled: {
    title: "Nic nie jest zaplanowane",
    text: "Zatwierdzone wiadomości możesz zaplanować na konkretną godzinę (wysyłka w cyklu harmonogramu, do ok. godziny opóźnienia).",
  },
  sent: {
    title: "Jeszcze nic nie wysłano",
    text: "Wysłane przez Gmail lub oznaczone jako wysłane ręcznie pojawią się tutaj.",
  },
  replies: {
    title: "Brak odpowiedzi",
    text: "Odpowiedzi pojawiają się po synchronizacji Gmaila (wymaga uprawnienia do odczytu nagłówków) albo gdy oznaczysz je ręcznie przy kontakcie.",
  },
  problems: {
    title: "Brak problemów",
    text: "Tutaj trafią wiadomości odrzucone przez Gmail lub o niepewnym wyniku wysyłki.",
  },
};

export function MessagesView() {
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const box = (BOXES.find((b) => b.id === sp.get("box"))?.id ?? "drafts") as Box;
  const [rows, setRows] = useState<(MsgRow | ReplyRow)[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    setError(null);
    apiFetch<{ kind: string; rows: (MsgRow | ReplyRow)[] }>(`/api/messages?box=${box}`)
      .then((r) => setRows(r.rows))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Nie udało się wczytać"));
  }, [box]);

  async function reclassify(id: string, classification: string) {
    try {
      await apiFetch(`/api/inbound/${id}`, { method: "PATCH", body: { classification } });
      toast("Zmieniono klasyfikację");
      setRows(
        (r) =>
          r?.map((x) => ((x as ReplyRow).id === id ? { ...(x as ReplyRow), classification } : x)) ?? null,
      );
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Nie udało się", "error");
    }
  }

  return (
    <>
      <nav className="subnav" aria-label="Skrzynki">
        {BOXES.map((b) => (
          <Link key={b.id} href={`/wiadomosci?box=${b.id}`} aria-current={box === b.id ? "page" : undefined}>
            {b.label}
          </Link>
        ))}
      </nav>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            {box === "replies" ? (
              <tr>
                <th>Od</th>
                <th>Firma</th>
                <th>Rodzaj</th>
                <th>Otrzymano</th>
                <th />
              </tr>
            ) : (
              <tr>
                <th>Odbiorca</th>
                <th>Temat</th>
                <th>Program</th>
                <th>{box === "sent" ? "Wysłano" : box === "scheduled" ? "Termin" : "Zmieniono"}</th>
                <th>Status</th>
              </tr>
            )}
          </thead>
          <tbody>
            {!rows && !error ? (
              <SkeletonRows cols={5} rows={6} />
            ) : error ? (
              <tr>
                <td colSpan={5}>
                  <Empty title="Błąd">{error}</Empty>
                </td>
              </tr>
            ) : rows!.length === 0 ? (
              <tr style={{ cursor: "default" }}>
                <td colSpan={5} style={{ whiteSpace: "normal" }}>
                  <Empty icon={<Inbox size={22} />} title={EMPTY[box].title}>
                    {EMPTY[box].text}
                  </Empty>
                </td>
              </tr>
            ) : box === "replies" ? (
              (rows as ReplyRow[]).map((r) => (
                <tr
                  key={r.id}
                  onClick={() => r.contactId && router.push(`/kontakty?c=${r.contactId}&view=all`)}
                >
                  <td>
                    <div className="cell-stack">
                      <span className="cell-primary">{r.who ?? r.fromEmail}</span>
                      <span className="cell-sub">{r.subject}</span>
                    </div>
                  </td>
                  <td className="small secondary">{r.companyName}</td>
                  <td onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <select
                      className="select"
                      style={{ width: 170, height: 28 }}
                      value={r.classification}
                      onChange={(e) => reclassify(r.id, e.target.value)}
                      aria-label="Rodzaj wiadomości"
                    >
                      <option value="human_reply">Odpowiedź</option>
                      <option value="auto_reply">Autoodpowiedź</option>
                      <option value="bounce">Zwrot (bounce)</option>
                      <option value="unknown">Nieokreślone</option>
                    </select>
                  </td>
                  <td className="small tabular secondary">{formatWarsaw(r.receivedAt)}</td>
                  <td />
                </tr>
              ))
            ) : (
              (rows as MsgRow[]).map((m) => (
                <tr key={m.id} onClick={() => router.push(`/wiadomosci/${m.id}`)}>
                  <td>
                    <div className="cell-stack">
                      <span className="cell-primary ellipsis">{m.who}</span>
                      <span className="cell-sub">{m.companyName}</span>
                    </div>
                  </td>
                  <td>
                    <div className="cell-stack">
                      <span className="ellipsis">
                        {m.subject || <span className="muted">(bez tematu)</span>}
                      </span>
                      {m.sendError ? (
                        <span className="cell-sub" style={{ color: "var(--bad)" }}>
                          {m.sendError}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="small secondary">
                    {m.programName ?? "—"} · {m.language.toUpperCase()}
                    {m.kind === "follow_up" ? " · follow-up" : ""}
                  </td>
                  <td className="small tabular secondary">
                    {formatWarsaw(
                      box === "sent" ? m.sentAt : box === "scheduled" ? m.scheduledFor : m.updatedAt,
                      "d LLL, HH:mm",
                    )}
                  </td>
                  <td>
                    <span className="status">
                      <Dot
                        tone={
                          m.status === "sent"
                            ? "accent"
                            : m.status === "approved"
                              ? "ok"
                              : m.status === "failed" || m.status === "uncertain"
                                ? "bad"
                                : "hollow"
                        }
                      />
                      {{
                        draft: "Szkic",
                        approved: "Zatwierdzony",
                        scheduled: "Zaplanowany",
                        sending: "Wysyłanie",
                        sent: "Wysłany",
                        failed: "Błąd",
                        uncertain: "Wynik niepewny",
                        cancelled: "Anulowany",
                      }[m.status] ?? m.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
