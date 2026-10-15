import { z } from "zod";
import { api, conflict, parseBody } from "@/server/http";
import { runGenerate } from "@/server/services/composer";
import { getMessage } from "@/server/services/messages";

export const maxDuration = 300;

export const POST = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(
    req,
    z.object({
      overwrite: z.boolean().default(false),
      salutation: z.enum(["neutral", "pani", "pan"]).default("neutral"),
    }),
  );
  const m = await getMessage(params.id);
  // Never regenerate over edited content without an explicit confirmation.
  if (m.userEdited && m.body.trim() && !b.overwrite)
    throw conflict(
      "Szkic zawiera Twoje zmiany. Potwierdź, że chcesz wygenerować nową wersję (obecna trafi do historii).",
      { needsConfirm: true },
    );
  return runGenerate(params.id, b.salutation);
});
