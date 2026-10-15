import { NextResponse } from "next/server";
import { authorizationUrl } from "@/server/gmail/oauth";
import { api, searchParams } from "@/server/http";

export const GET = api(async (req) => {
  const purpose = searchParams(req).get("purpose") === "read" ? "read" : "send";
  return NextResponse.redirect(await authorizationUrl(purpose));
});
