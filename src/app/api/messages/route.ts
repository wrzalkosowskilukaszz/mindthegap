import { z } from "zod";
import { api, parseBody, searchParams } from "@/server/http";
import { createDraft, listMessages } from "@/server/services/messages";

export const GET = api(async (req) => {
  const box = z.enum(["drafts", "scheduled", "sent", "replies", "problems"]).catch("drafts").parse(searchParams(req).get("box") ?? "drafts");
  return listMessages(box);
});

export const POST = api(async (req) => {
  const b = await parseBody(
    req,
    z.object({
      contactId: z.string().uuid(),
      programId: z.string().uuid().nullable(),
      language: z.enum(["pl", "en"]),
      kind: z.enum(["initial", "follow_up"]).optional(),
      parentMessageId: z.string().uuid().nullable().optional(),
    }),
  );
  const m = await createDraft(b);
  return { id: m.id };
});
