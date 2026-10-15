import { Plus, Search, Settings } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { LogoutButton, SidebarNav, TabBar } from "@/components/nav";
import { ToastProvider } from "@/components/toast";
import { formatWarsaw } from "@/lib/time";
import { requireSession } from "@/server/auth/session";
import { systemStatus } from "@/server/services/status";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireSession();
  const s = await systemStatus();
  const profile = await getSettings("profile");
  const firstName = profile.senderName.trim().split(/\s+/)[0] || "Julia";
  const gmailDot = !s.gmail ? "dot-hollow" : s.gmail.status === "connected" ? "dot-ok" : "dot-bad";
  const gmailLabel = !s.gmail
    ? "Gmail niepołączony"
    : s.gmail.status === "connected"
      ? "Gmail połączony"
      : "Gmail wymaga ponownej autoryzacji";
  return (
    <ToastProvider>
      <a href="#content" className="skip-link">
        Przejdź do treści
      </a>
      <div className="shell">
        <aside className="sidebar">
          <Link href="/kontakty" style={{ textDecoration: "none" }}>
            <Brand />
          </Link>
          <SidebarNav counts={{ "/kontakty": s.newContacts, "/wiadomosci": s.drafts }} />
          <div className="sidebar-footer">
            <Link href="/kontakty/odkrywanie" className="health secondary" style={{ textDecoration: "none" }}>
              <span
                className={`dot ${s.scheduler.enabled ? (s.scheduler.tickHealthy ? "dot-ok" : "dot-warn") : "dot-hollow"}`}
              />
              {s.scheduler.enabled
                ? `Następne szukanie ${formatWarsaw(s.scheduler.nextRunAt, "d LLL, HH:mm")}`
                : "Szukanie wstrzymane"}
            </Link>
            <Link href="/ustawienia#gmail" className="health secondary" style={{ textDecoration: "none" }}>
              <span className={`dot ${gmailDot}`} />
              {gmailLabel}
            </Link>
            {s.openIssues > 0 ? (
              <Link
                href="/aktywnosc#zdarzenia"
                className="health"
                style={{ color: "var(--warn)", textDecoration: "none" }}
              >
                <span className="dot dot-warn" />
                {s.openIssues} {s.openIssues === 1 ? "sprawa wymaga uwagi" : "spraw wymaga uwagi"}
              </Link>
            ) : null}
            <LogoutButton />
          </div>
        </aside>
        <div className="main">
          <header className="topbar">
            <form action="/kontakty" method="get" className="topbar-search" aria-label="Szukaj kontaktów">
              <input type="hidden" name="view" value="all" />
              <input name="q" type="search" placeholder="Szukaj osoby, firmy, adresu…" aria-label="Szukaj" />
              <button type="submit" aria-label="Szukaj">
                <Search size={19} strokeWidth={1.8} />
              </button>
            </form>
            <div className="topbar-spacer" />
            <Link
              href="/wiadomosci/nowa"
              className="icon-circle"
              aria-label="Nowa wiadomość"
              title="Nowa wiadomość"
            >
              <Plus size={19} strokeWidth={1.8} />
            </Link>
            <Link href="/ustawienia" className="icon-circle" aria-label="Ustawienia" title="Ustawienia">
              <Settings size={18} strokeWidth={1.8} />
            </Link>
            <div className="user-chip">
              <span className="avatar" aria-hidden="true">
                {firstName.charAt(0).toUpperCase()}
              </span>
              <div>
                <strong>{firstName}</strong>
                <span>Mind the Gap</span>
              </div>
            </div>
          </header>
          <div id="content">{children}</div>
        </div>
      </div>
      <TabBar />
    </ToastProvider>
  );
}
