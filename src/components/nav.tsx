"use client";

import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  Layers,
  LogOut,
  Mail,
  MoreHorizontal,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

const MAIN = [
  { href: "/kontakty", label: "Kontakty", icon: Users },
  { href: "/wiadomosci", label: "Wiadomości", icon: Mail },
  { href: "/materialy", label: "Moja oferta", icon: Layers },
] as const;

/** Places where you meet buyers: requests for quotes and events. */
const CHANCES = [
  { href: "/zapytania", label: "Zapytania ofertowe", icon: ClipboardList },
  { href: "/wydarzenia", label: "Wydarzenia", icon: CalendarDays },
] as const;

const CAREER = [{ href: "/oferty", label: "Oferty pracy", icon: BriefcaseBusiness }] as const;

const OTHER = [
  { href: "/aktywnosc", label: "Statystyki", icon: BarChart3 },
  { href: "/ustawienia", label: "Ustawienia", icon: Settings },
] as const;

const ALL = [...MAIN, ...CHANCES, ...CAREER, ...OTHER];
// Phone tab bar: four places plus "Więcej", which lists the rest.
const TABS = [MAIN[0], MAIN[1], { ...CHANCES[0], label: "Zapytania" }, { ...CAREER[0], label: "Praca" }];
const MORE = [CHANCES[1], MAIN[2], ...OTHER];

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
      <div className="nav-section-label">Okazje</div>
      {CHANCES.map(item)}
      <div className="nav-section-label">Kariera</div>
      {CAREER.map(item)}
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
  const sheet = useRef<HTMLDivElement>(null);
  const moreActive = MORE.some((m) => isActive(path, m.href));
  return (
    <nav aria-label="Nawigacja" className="tabbar">
      {TABS.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined}>
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
          {label}
        </Link>
      ))}
      <button
        type="button"
        popoverTarget="more-sheet"
        aria-current={moreActive ? "page" : undefined}
        aria-label="Więcej miejsc"
      >
        <MoreHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />
        Więcej
      </button>
      <div id="more-sheet" ref={sheet} popover="auto" className="more-sheet">
        {MORE.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(path, href) ? "page" : undefined}
            onClick={() => sheet.current?.hidePopover()}
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </Link>
        ))}
        <LogoutButton />
      </div>
    </nav>
  );
}
