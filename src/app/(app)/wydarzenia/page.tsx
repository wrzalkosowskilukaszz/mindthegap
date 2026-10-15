import { Suspense } from "react";
import { EventsView } from "./events-view";

export const metadata = { title: "Wydarzenia" };

export default function EventsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Wydarzenia</h1>
          <p>
            Konferencje, spotkania i webinary, na których poznasz osoby od szkoleń i HR. Gdy ktoś poprosi o
            Twoją ofertę, możesz ją wysłać mailem. Aplikacja sprawdza kalendarze raz dziennie.
          </p>
        </div>
        <div id="events-actions" />
      </header>
      <Suspense>
        <EventsView />
      </Suspense>
    </div>
  );
}
