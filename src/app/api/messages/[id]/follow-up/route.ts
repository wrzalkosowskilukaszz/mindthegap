import { api, badRequest } from "@/server/http";
import { createDraft, getMessage } from "@/server/services/messages";

export const POST = api<{ id: string }>(async (_req, { params }) => {
  const parent = await getMessage(params.id);
  if (parent.status !== "sent") throw badRequest("Follow-up można przygotować tylko do wysłanej wiadomości.");
  const m = await createDraft({ contactId: parent.contactId, programId: parent.programId, language: parent.language, kind: "follow_up", parentMessageId: parent.id });
  return { id: m.id };
});
