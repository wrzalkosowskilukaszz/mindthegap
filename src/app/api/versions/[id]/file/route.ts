import { api, searchParams } from "@/server/http";
import { readFile } from "@/server/materials/service";

/** Private file access: requires the owner's session (enforced by `api`). */
export const GET = api<{ id: string }>(async (req, { params }) => {
  const { meta, content } = await readFile(params.id);
  const inline = searchParams(req).get("inline") === "1" && meta.mimeType === "application/pdf";
  return new Response(new Uint8Array(content), {
    headers: {
      "content-type": meta.mimeType,
      "content-length": String(content.length),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(meta.filename)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
