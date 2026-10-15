import { Suspense } from "react";
import { CONTACTS_SUBNAV, SubNav } from "@/components/ui";
import { systemStatus } from "@/server/services/status";
import { ContactsView } from "./contacts-view";

export const metadata = { title: "Kontakty" };

export default async function ContactsPage() {
  const s = await systemStatus();
  let attention: { tone: "warn" | "bad" | "info"; text: string; href: string } | null = null;
  if (s.lastRun?.status === "failed")
    attention = {
      tone: "bad",
      text: "Ostatni przebieg odkrywania zakończył się błędem.",
      href: "/kontakty/odkrywanie",
    };
  else if (s.lastRun?.status === "budget_exhausted")
    attention = {
      tone: "warn",
      text: "Ostatni przebieg zatrzymał się na limicie wydatków.",
      href: "/kontakty/odkrywanie",
    };
  else if (s.lastRun?.status === "partial")
    attention = {
      tone: "warn",
      text: "Ostatni przebieg zakończył się częściowo — część zadań wymaga ponowienia.",
      href: "/kontakty/odkrywanie",
    };
  else if (s.scheduler.enabled && !s.scheduler.tickHealthy && s.lastRun)
    attention = {
      tone: "warn",
      text: s.scheduler.lastTickAt
        ? "Harmonogram nie zgłosił się od ponad 3 godzin — codzienne odkrywanie może nie działać."
        : "Harmonogram jeszcze się nie zgłosił — bez niego codzienne odkrywanie nie ruszy.",
      href: "/kontakty/odkrywanie",
    };
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Kontakty</h1>
          <p>Osoby i działy odpowiedzialne za rozwój pracowników — z dowodami i statusem weryfikacji.</p>
        </div>
        <div id="contacts-actions" />
      </header>
      <SubNav items={CONTACTS_SUBNAV} />
      <Suspense>
        <ContactsView attention={attention} />
      </Suspense>
    </div>
  );
}
