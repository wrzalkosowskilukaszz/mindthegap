import { Suspense } from "react";
import { MessagesView } from "./messages-view";

export const metadata = { title: "Wiadomości" };

export default function MessagesPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Wiadomości</h1>
          <p>
            Szkice, zaplanowane, wysłane i odpowiedzi. „Wysłana” oznacza przyjętą przez Gmail lub oznaczoną
            przez Ciebie — nie doręczenie ani przeczytanie.
          </p>
        </div>
      </header>
      <Suspense>
        <MessagesView />
      </Suspense>
    </div>
  );
}
