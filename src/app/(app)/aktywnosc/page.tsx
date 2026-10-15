import { ActivityView } from "./activity-view";

export const metadata = { title: "Statystyki" };

export default function ActivityPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Statystyki</h1>
          <p>Ile kontaktów znaleziono, ile maili wysłano i ile osób odpowiedziało.</p>
        </div>
      </header>
      <ActivityView />
    </div>
  );
}
