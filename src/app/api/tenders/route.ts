import { z } from "zod";
import { api, searchParams } from "@/server/http";
import { listTenders, TENDER_VIEWS } from "@/server/tenders/service";

export const GET = api(async (req) => {
  const p = searchParams(req);
  const view = z
    .enum(TENDER_VIEWS)
    .catch("best")
    .parse(p.get("view") ?? "best");
  const offset = Math.max(0, Number(p.get("offset")) || 0);
  return listTenders({ view, q: p.get("q") ?? undefined, near: p.get("near") === "1", offset });
});
