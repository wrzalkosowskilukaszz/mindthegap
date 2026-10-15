import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Outreach Studio", template: "%s · Outreach Studio" },
  description: "Mind the Gap — prywatne narzędzie do badań kontaktów i korespondencji.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#f3f5f8",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Rendered per request, so every page (also "not found") gets the CSP nonce for its scripts.
  await connection();
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
