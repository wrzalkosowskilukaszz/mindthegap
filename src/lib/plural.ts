/** Polish plural: 1 sprawa, 2–4 sprawy, 5+ spraw (12–14 always "spraw"). */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}

const usdFmt = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "USD" });
/** "0,00 USD" — amounts in Polish format. */
export function usd(n: number | string): string {
  return usdFmt.format(Number(n) || 0);
}

/** "512 KB", "1,4 MB" */
export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} MB`;
}
