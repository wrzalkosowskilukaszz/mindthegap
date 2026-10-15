import Link from "next/link";
import { DiscoveryView } from "./discovery-view";

export const metadata = { title: "Wyszukiwanie kontaktów" };

export default function DiscoveryPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link href="/ustawienia" className="small">
            ← Ustawienia
          </Link>
          <h1>Wyszukiwanie kontaktów</h1>
          <p>Aplikacja sama szuka nowych firm i kontaktów codziennie rano. Tu widać, jak jej idzie.</p>
        </div>
      </header>
      <DiscoveryView />
    </div>
  );
}
