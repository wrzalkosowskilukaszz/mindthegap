import { MaterialsView } from "./materials-view";

export const metadata = { title: "Materiały" };

export default function MaterialsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Materiały</h1>
          <p>Programy szkoleniowe, pliki ofert i Twój głos. Do maili trafia tylko to, co zatwierdzisz.</p>
        </div>
      </header>
      <MaterialsView />
    </div>
  );
}
