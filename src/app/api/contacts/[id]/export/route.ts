import { api, notFound } from "@/server/http";
import { exportContact } from "@/server/services/privacy";

export const GET = api<{ id: string }>(async (_req, { params }) => {
  const data = await exportContact(params.id);
  if (!data) throw notFound();
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="kontakt-${params.id}.json"`, "cache-control": "no-store" },
  });
});
