import { z } from "zod";
import { api, parseBody } from "@/server/http";
import { promptFor } from "@/server/services/composer";

/** A ready prompt to paste into a free ChatGPT or Claude chat (nothing is sent to any AI from here). */
export const POST = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(
    req,
    z.object({ salutation: z.enum(["neutral", "pani", "pan"]).default("neutral") }),
  );
  return promptFor(params.id, b.salutation);
});
