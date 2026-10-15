/** The Mind the Gap mark: two bars with a gap, on the green tile. */
export function BrandLogo({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-logo-svg">
      <defs>
        <linearGradient id="brand-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0e9a69" />
          <stop offset="1" stopColor="#1fca8c" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#brand-g)" />
      <rect x="6.5" y="14.8" width="7.5" height="2.6" rx="1.3" fill="#fff" />
      <rect x="18" y="14.8" width="7.5" height="2.6" rx="1.3" fill="#fff" fillOpacity="0.7" />
    </svg>
  );
}

export function Brand() {
  return (
    <span className="brand">
      <BrandLogo />
      <span>
        <span className="brand-mark">Mind the Gap</span>
        <span className="brand-sub">Outreach Studio</span>
      </span>
    </span>
  );
}
