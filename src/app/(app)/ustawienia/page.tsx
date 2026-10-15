import { Suspense } from "react";
import { SettingsView } from "./settings-view";

export const metadata = { title: "Ustawienia" };

export default function SettingsPage() {
  return (
    <div className="page page-narrow">
      <header className="page-header">
        <div>
          <h1>Ustawienia</h1>
          <p>Połączenia, zasady świeżości danych, korespondencja i prywatność.</p>
        </div>
      </header>
      <Suspense>
        <SettingsView />
      </Suspense>
    </div>
  );
}
