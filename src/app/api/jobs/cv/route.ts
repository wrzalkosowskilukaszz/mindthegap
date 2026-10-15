import { removeCv, saveCv } from "@/server/careers/service";
import { api, badRequest, searchParams } from "@/server/http";
import { extractText, mimeFromName } from "@/server/materials/extract-text";

export const maxDuration = 60;
const MAX = 4 * 1024 * 1024;

/** Upload the CV as the raw request body (?name=cv.pdf). Only its text is kept, never the file. */
export const POST = api(async (req) => {
  const name = (searchParams(req).get("name") ?? "cv").slice(0, 200);
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length) throw badRequest("Pusty plik");
  if (buf.length > MAX) throw badRequest("Plik jest za duży (maks. 4 MB)");
  const mime = mimeFromName(name, req.headers.get("content-type") ?? "");
  if (!/pdf|wordprocessingml|msword|text\/plain/.test(mime))
    throw badRequest("Wgraj CV jako PDF, DOCX lub TXT.");
  const ex = await extractText(buf, mime);
  await saveCv(name, ex.text ?? "");
  return { ok: true };
});

export const DELETE = api(async () => {
  await removeCv();
  return { ok: true };
});
