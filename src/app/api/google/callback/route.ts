import { NextResponse } from "next/server";
import { env } from "@/server/env";
import { api, searchParams } from "@/server/http";
import { handleCallback } from "@/server/gmail/oauth";

export const GET = api(async (req) => {
  const sp = searchParams(req);
  const base = `${env().APP_URL.replace(/\/$/, "")}/ustawienia`;
  if (sp.get("error")) return NextResponse.redirect(`${base}?gmail=denied#gmail`);
  try {
    await handleCallback(sp.get("code") ?? "", sp.get("state") ?? "");
    return NextResponse.redirect(`${base}?gmail=connected#gmail`);
  } catch (e) {
    const msg = encodeURIComponent((e instanceof Error ? e.message : "Błąd").slice(0, 200));
    return NextResponse.redirect(`${base}?gmail=error&detail=${msg}#gmail`);
  }
});
