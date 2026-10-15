import { tailoredCvDocx } from "@/server/careers/service";
import { api } from "@/server/http";

/** The tailored CV of one offer as a Word file (owner's session required, enforced by `api`). */
export const GET = api<{ id: string }>(async (_req, { params }) => {
  const { file, filename } = await tailoredCvDocx(params.id);
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-length": String(file.length),
      "content-disposition": `attachment; filename="CV.docx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
