"use client";

import { AlertTriangle, Info, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import {
  EMAIL_STATUS_LABEL,
  type EmailStatus,
  OUTREACH_LABEL,
  type OutreachStatus,
  QUALITY_LABEL,
  type Quality,
} from "@/lib/contact-rules";
import { formatWarsaw } from "@/lib/time";

export function Dot({ tone }: { tone: "ok" | "warn" | "bad" | "accent" | "neutral" | "hollow" }) {
  const cls = tone === "neutral" ? "" : `dot-${tone}`;
  return <span className={`dot ${cls}`} aria-hidden="true" />;
}

export function EmailStatusLabel({ status, at }: { status: EmailStatus; at?: string | null }) {
  const tone =
    status === "valid" ? "ok" : status === "invalid" ? "bad" : status === "not_checked" ? "hollow" : "warn";
  return (
    <span className="status">
      <Dot tone={tone} />
      {EMAIL_STATUS_LABEL[status]}
      {at ? <span className="muted"> · {formatWarsaw(at, "d.MM.yy")}</span> : null}
    </span>
  );
}

export function QualityLabel({ quality }: { quality: string }) {
  const q = quality as Quality;
  const tone = q === "ready" ? "ok" : q === "caution" ? "warn" : q === "blocked" ? "bad" : "hollow";
  return (
    <span className="status">
      <Dot tone={tone} />
      {QUALITY_LABEL[q] ?? quality}
    </span>
  );
}

export function OutreachLabel({ status, at }: { status: OutreachStatus; at?: string | null }) {
  const tone =
    status === "replied"
      ? "ok"
      : status === "follow_up_due"
        ? "warn"
        : status === "failed" || status === "do_not_contact"
          ? "bad"
          : status === "sent" || status === "scheduled"
            ? "accent"
            : "hollow";
  return (
    <span className="status">
      <Dot tone={tone} />
      {OUTREACH_LABEL[status]}
      {at ? <span className="muted"> · {formatWarsaw(at, "d.MM")}</span> : null}
    </span>
  );
}

export function Callout({
  tone = "warn",
  children,
}: {
  tone?: "warn" | "info" | "bad";
  children: ReactNode;
}) {
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <div
      className={`callout ${tone === "info" ? "callout-info" : tone === "bad" ? "callout-bad" : ""}`}
      role={tone === "bad" ? "alert" : undefined}
    >
      <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
      <div className="stack" style={{ gap: 4 }}>
        {children}
      </div>
    </div>
  );
}

export function Empty({
  icon,
  title,
  children,
  actions,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {actions ? <div className="btn-group">{actions}</div> : null}
    </div>
  );
}

export function SkeletonRows({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => `sk-${r}`).map((rowKey, r) => (
        <tr key={rowKey} style={{ cursor: "default" }}>
          {Array.from({ length: cols }, (_, c) => `${rowKey}-${c}`).map((cellKey, c) => (
            <td key={cellKey}>
              <span className="skeleton" style={{ width: `${40 + ((r * 7 + c * 13) % 45)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""}`}
      onClose={onClose}
      aria-labelledby="dialog-title"
    >
      {open ? (
        <>
          <div className="dialog-header row-between" style={{ alignItems: "flex-start" }}>
            <div>
              <h3 id="dialog-title">{title}</h3>
              {description ? <p>{description}</p> : null}
            </div>
            <button
              type="button"
              className="btn btn-quiet btn-icon btn-sm"
              onClick={onClose}
              aria-label="Zamknij"
            >
              <X size={16} />
            </button>
          </div>
          <div className="dialog-body">{children}</div>
          {footer ? <div className="dialog-footer">{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}

export function SubNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="subnav" aria-label="Sekcje">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={path === i.href ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export const CONTACTS_SUBNAV = [
  { href: "/kontakty", label: "Do kogo pisać" },
  { href: "/kontakty/firmy", label: "Firmy" },
];

/** Click-outside + Escape for popovers. */
export function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose]);
  return ref;
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  );
}

export function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
