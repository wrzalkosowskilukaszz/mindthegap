import { api, badRequest } from "@/server/http";
import { CHUNK_BYTES, putChunk } from "@/server/materials/service";

export const PUT = api<{ id: string; idx: string }>(async (req, { params }) => {
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0 || buf.length > CHUNK_BYTES) throw badRequest("Nieprawidłowy rozmiar fragmentu.");
  await putChunk(params.id, Number(params.idx), buf);
  return { ok: true };
});
