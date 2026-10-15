import { ActivityView } from "./activity-view";

export const metadata = { title: "Aktywność" };

export default function ActivityPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Aktywność</h1>
          <p>Kilka liczb, które pomagają działać — z definicjami. Bez lejków sprzedaży i prognoz.</p>
        </div>
      </header>
      <ActivityView />
    </div>
  );
}
