"use client";

import { BarChart3, Briefcase, LogOut, Mail, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const MAIN = [
  { href: "/kontakty", label: "Kontakty", icon: Users },
  { href: "/wiadomosci", label: "Wiadomości", icon: Mail },
  { href: "/materialy", label: "Moja oferta", icon: Briefcase },
] as const;

const OTHER = [
  { href: "/aktywnosc", label: "Statystyki", icon: BarChart3 },
  { href: "/ustawienia", label: "Ustawienia", icon: Settings },
] as const;

const ALL = [...MAIN, ...OTHER];

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function SidebarNav({ counts }: { counts: Partial<Record<string, number>> }) {
  const path = usePathname();
  const item = ({ href, label, icon: Icon }: (typeof ALL)[number]) => {
    const count = counts[href];
    return (
      <Link
        key={href}
        href={href}
        className="nav-item"
        aria-current={isActive(path, href) ? "page" : undefined}
      >
        <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
        {label}
        {count ? <span className="nav-count">{count}</span> : null}
      </Link>
    );
  };
  return (
    <nav aria-label="Główna nawigacja" className="stack" style={{ gap: 4 }}>
      <div className="nav-section-label">Główne</div>
      {MAIN.map(item)}
      <div className="nav-section-label">Inne</div>
      {OTHER.map(item)}
    </nav>
  );
}

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="logout"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
        window.location.assign("/login");
      }}
    >
      <LogOut size={20} strokeWidth={1.7} aria-hidden="true" />
      Wyloguj
    </button>
  );
}

export function TabBar() {
  const path = usePathname();
  return (
    <nav aria-label="Nawigacja" className="tabbar">
      {ALL.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined}>
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
