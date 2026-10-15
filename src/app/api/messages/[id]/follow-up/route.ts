import { api, badRequest } from "@/server/http";
import { runGenerate } from "@/server/services/composer";
import { createDraft, getMessage } from "@/server/services/messages";

export const POST = api<{ id: string }>(async (_req, { params }) => {
  const parent = await getMessage(params.id);
  if (parent.status !== "sent") throw badRequest("Follow-up można przygotować tylko do wysłanej wiadomości.");
  const m = await createDraft({
    contactId: parent.contactId,
    programId: parent.programId,
    language: parent.language,
    kind: "follow_up",
    parentMessageId: parent.id,
  });
  // Filled right away, like a first email (free template unless an AI key is set).
  if (!m.body.trim()) await runGenerate(m.id, "neutral").catch(() => {});
  return { id: m.id };
});
