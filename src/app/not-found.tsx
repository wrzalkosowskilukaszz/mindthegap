import Link from "next/link";
import { BrandLogo } from "@/components/brand";

export const metadata = { title: "Nie znaleziono" };

export default function NotFound() {
  return (
    <main className="login">
      <div className="login-card" style={{ textAlign: "center", alignItems: "center" }}>
        <BrandLogo size={44} />
        <h1>Nie ma takiej strony</h1>
        <p className="login-lead">Link mógł się zmienić albo coś zostało usunięte.</p>
        <Link href="/kontakty" className="btn btn-primary btn-lg">
          Wróć do kontaktów
        </Link>
      </div>
    </main>
  );
}
