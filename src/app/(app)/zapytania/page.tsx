import { Suspense } from "react";
import { TendersView } from "./tenders-view";

export const metadata = { title: "Zapytania ofertowe" };

export default function TendersPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Zapytania ofertowe</h1>
          <p>
            Firmy i organizacje, które same szukają trenera: zapytania o szkolenia, warsztaty i coaching z
            Bazy Konkurencyjności. Odpowiedź na nie nie wymaga osobnej zgody. Aplikacja sprawdza je co 12
            godzin.
          </p>
        </div>
      </header>
      <Suspense>
        <TendersView />
      </Suspense>
    </div>
  );
}
