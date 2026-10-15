import { MaterialsView } from "./materials-view";

export const metadata = { title: "Moja oferta" };

export default function MaterialsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Moja oferta</h1>
          <p>Twoje usługi, pliki do maili i podpis. Z tego korzystają szkice maili.</p>
        </div>
      </header>
      <MaterialsView />
    </div>
  );
}
