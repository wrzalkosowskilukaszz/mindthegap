import { Building2, Send, Users } from "lucide-react";
import Link from "next/link";
import type { HomeStats } from "@/server/services/home";

const nf = new Intl.NumberFormat("pl-PL");

/** Three big numbers at the top of Kontakty. The small charts show real data, never decoration. */
export function StatCards({ s }: { s: HomeStats }) {
  const max = Math.max(1, ...s.newPerDay.map((d) => d.n));
  const pct = s.companies ? Math.round((100 * s.researched) / s.companies) : 0;
  const r = 46;
  const circ = 2 * Math.PI * r;
  return (
    <section className="stat-cards" aria-label="Podsumowanie">
      <Link href="/kontakty?view=to-contact" className="stat-card">
        <span className="metric-icon">
          <Users size={24} strokeWidth={1.8} />
        </span>
        <span
          className="stat-deco"
          role="img"
          aria-label={`Nowe kontakty w ostatnich ${s.newPerDay.length} dniach: ${s.newPerDay.reduce((a, d) => a + d.n, 0)}`}
        >
          {s.newPerDay.map((d) => (
            <span
              key={d.day}
              title={`${d.day}: ${d.n}`}
              style={{ height: `${Math.max(14, (100 * d.n) / max)}%` }}
            />
          ))}
        </span>
        <span className="metric-value">{nf.format(s.toContact)}</span>
        <span className="metric-label">Do kogo możesz napisać</span>
      </Link>
      <Link href="/kontakty/firmy" className="stat-card">
        <span className="metric-icon">
          <Building2 size={24} strokeWidth={1.8} />
        </span>
        <svg className="stat-ring" viewBox="0 0 120 120" role="img" aria-label={`Zbadano ${pct}% firm`}>
          <defs>
            <linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#1fca8c" />
              <stop offset="1" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r={r} fill="none" stroke="#eef1f5" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="url(#ring-g)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(circ * pct) / 100} ${circ}`}
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="56" textAnchor="middle" className="ring-label">
            zbadane
          </text>
          <text x="60" y="76" textAnchor="middle" className="ring-value">
            {pct}%
          </text>
        </svg>
        <span className="metric-value">{nf.format(s.companies)}</span>
        <span className="metric-label">Firm w bazie</span>
      </Link>
      <Link href="/wiadomosci?box=sent" className="stat-card">
        <span className="metric-icon">
          <Send size={22} strokeWidth={1.8} />
        </span>
        <span className="stat-side">
          <strong>{nf.format(s.repliesThisMonth)}</strong>
          {s.repliesThisMonth === 1 ? "odpowiedź" : "odpowiedzi"}
        </span>
        <span className="metric-value">{nf.format(s.sentThisMonth)}</span>
        <span className="metric-label">Wysłane w tym miesiącu</span>
      </Link>
    </section>
  );
}
