import Link from "next/link";
import type { ReactNode } from "react";
import { SidebarNav, TabBar } from "@/components/nav";
import { ToastProvider } from "@/components/toast";
import { formatWarsaw } from "@/lib/time";
import { requireSession } from "@/server/auth/session";
import { systemStatus } from "@/server/services/status";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireSession();
  const s = await systemStatus();
  const gmailDot = !s.gmail ? "dot-hollow" : s.gmail.status === "connected" ? "dot-ok" : "dot-bad";
  const gmailLabel = !s.gmail ? "Gmail niepołączony" : s.gmail.status === "connected" ? "Gmail połączony" : "Gmail wymaga ponownej autoryzacji";
  return (
    <ToastProvider>
      <a href="#content" className="skip-link">
        Przejdź do treści
      </a>
      <div className="shell">
        <aside className="sidebar">
          <Link href="/kontakty" className="brand" style={{ textDecoration: "none" }}>
            <span>
              <span className="brand-mark">
                Mind<span className="brand-gap" aria-hidden="true" />the Gap
              </span>
              <span className="brand-sub">Outreach Studio</span>
            </span>
          </Link>
          <SidebarNav counts={{ "/kontakty": s.newContacts, "/wiadomosci": s.drafts }} />
          <div className="sidebar-footer">
            <Link href="/kontakty/odkrywanie" className="health secondary" style={{ textDecoration: "none" }}>
              <span className={`dot ${s.scheduler.enabled ? (s.scheduler.tickHealthy ? "dot-ok" : "dot-warn") : "dot-hollow"}`} />
              {s.scheduler.enabled ? `Następny przebieg ${formatWarsaw(s.scheduler.nextRunAt, "d LLL, HH:mm")}` : "Harmonogram wstrzymany"}
            </Link>
            <Link href="/ustawienia#gmail" className="health secondary" style={{ textDecoration: "none" }}>
              <span className={`dot ${gmailDot}`} />
              {gmailLabel}
            </Link>
            {s.openIssues > 0 ? (
              <Link href="/aktywnosc#zdarzenia" className="health" style={{ color: "var(--warn)", textDecoration: "none" }}>
                <span className="dot dot-warn" />
                {s.openIssues} {s.openIssues === 1 ? "sprawa wymaga uwagi" : "spraw wymaga uwagi"}
              </Link>
            ) : null}
          </div>
        </aside>
        <div className="main" id="content">
          {children}
        </div>
      </div>
      <TabBar />
    </ToastProvider>
  );
}
