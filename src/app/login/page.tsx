import { redirect } from "next/navigation";
import { hasValidSession } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Logowanie" };

export default async function LoginPage() {
  if (await hasValidSession()) redirect("/kontakty");
  return (
    <main className="login">
      <div className="login-card">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark">
            Mind
            <span className="brand-gap" aria-hidden="true" />
            the Gap
          </span>
        </div>
        <div>
          <h1>Outreach Studio</h1>
          <p className="secondary small" style={{ marginTop: 6 }}>
            Prywatna aplikacja. Zaloguj się hasłem właściciela.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
