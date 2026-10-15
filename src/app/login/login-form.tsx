"use client";

import { useState } from "react";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const password = new FormData(e.currentTarget).get("password");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (res?.ok) {
      window.location.assign("/witaj");
      return;
    }
    const data = res ? await res.json().catch(() => ({})) : {};
    setError((data as { error?: string }).error ?? "Brak połączenia z serwerem.");
    setBusy(false);
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <label className="field">
        <span className="field-label">Hasło</span>
        <input
          className="input"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••••"
          required
          autoFocus
        />
      </label>
      {error && (
        <p role="alert" className="small" style={{ color: "var(--bad)" }}>
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : null}
        Zaloguj
      </button>
    </form>
  );
}
