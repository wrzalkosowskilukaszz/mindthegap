import { CONTACTS_SUBNAV, SubNav } from "@/components/ui";
import { CompaniesView } from "./companies-view";

export const metadata = { title: "Firmy i pokrycie" };

export default function CompaniesPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Kontakty</h1>
          <p>
            Badany zbiór firm, źródła i pokrycie: gdzie mamy trafny kontakt, a gdzie potrzeba więcej pracy.
          </p>
        </div>
      </header>
      <SubNav items={CONTACTS_SUBNAV} />
      <CompaniesView />
    </div>
  );
}
