import { z } from "zod";
import { api, parseBody } from "@/server/http";
import { runRewrite } from "@/server/services/composer";

export const maxDuration = 300;

export const POST = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(
    req,
    z.object({
      action: z.enum([
        "shorten",
        "more_direct",
        "warmer",
        "stronger_value",
        "better_opening",
        "change_cta",
        "rewrite_selection",
      ]),
      selection: z.string().max(5000).optional(),
      instruction: z.string().max(500).optional(),
      salutation: z.enum(["neutral", "pani", "pan"]).default("neutral"),
    }),
  );
  return runRewrite(params.id, b.action, {
    selection: b.selection,
    instruction: b.instruction,
    salutation: b.salutation,
  });
});
