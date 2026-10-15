import { z } from "zod";
import { api, parseBody } from "@/server/http";
import { CHUNK_BYTES, startVersion } from "@/server/materials/service";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(req, z.object({ filename: z.string().min(1).max(250), mimeType: z.string().max(200), sizeBytes: z.number().int(), sha256: z.string() }));
  const v = await startVersion(params.id, b);
  return { id: v.id, version: v.version, chunkCount: v.chunkCount, chunkBytes: CHUNK_BYTES };
});
