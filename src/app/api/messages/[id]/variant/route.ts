import { z } from "zod";
import { api, badRequest, parseBody } from "@/server/http";
import { getMessage, saveGenerated } from "@/server/services/messages";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const { kind } = await parseBody(req, z.object({ kind: z.enum(["shorter", "distinctive"]) }));
  const m = await getMessage(params.id);
  const v = m.generation.variants?.find((x) => x.kind === kind);
  if (!v) throw badRequest("Brak tego wariantu — wygeneruj szkic.");
  await saveGenerated(params.id, { subject: m.subject, body: v.body, origin: "variant", label: kind === "shorter" ? "Wariant krótszy" : "Wariant wyrazisty" });
  return { ok: true };
});
