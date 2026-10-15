import { CONTACTS_SUBNAV, SubNav } from "@/components/ui";
import { DiscoveryView } from "./discovery-view";

export const metadata = { title: "Odkrywanie" };

export default function DiscoveryPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Kontakty</h1>
          <p>Codzienne odkrywanie: nowe firmy, badanie stron, uzupełnianie i odświeżanie danych.</p>
        </div>
      </header>
      <SubNav items={CONTACTS_SUBNAV} />
      <DiscoveryView />
    </div>
  );
}
