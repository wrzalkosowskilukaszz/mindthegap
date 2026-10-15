"use client";

import { Activity, FileText, Mail, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/kontakty", label: "Kontakty", icon: Users },
  { href: "/wiadomosci", label: "Wiadomości", icon: Mail },
  { href: "/materialy", label: "Materiały", icon: FileText },
  { href: "/aktywnosc", label: "Aktywność", icon: Activity },
  { href: "/ustawienia", label: "Ustawienia", icon: Settings },
] as const;

export function SidebarNav({ counts }: { counts: Partial<Record<string, number>> }) {
  const path = usePathname();
  return (
    <nav aria-label="Główna nawigacja" className="stack" style={{ gap: 2 }}>
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(`${href}/`);
        const count = counts[href];
        return (
          <Link key={href} href={href} className="nav-item" aria-current={active ? "page" : undefined}>
            <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
            {label}
            {count ? <span className="nav-count">{count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar() {
  const path = usePathname();
  return (
    <nav aria-label="Nawigacja" className="tabbar">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
