import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand";
import { hasValidSession } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Logowanie" };

export default async function LoginPage() {
  if (await hasValidSession()) redirect("/kontakty");
  return (
    <main className="login">
      <div className="login-brand">
        <BrandLogo size={44} />
        <span>
          <span className="brand-mark" style={{ fontSize: 22 }}>
            Mind the Gap
          </span>
          <span className="brand-sub">Outreach Studio</span>
        </span>
      </div>
      <div className="login-card">
        <div>
          <h1>Zaloguj się</h1>
          <p className="login-lead">Twoje prywatne studio kontaktów i korespondencji.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
