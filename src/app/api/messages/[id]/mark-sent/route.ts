import { z } from "zod";
import { markSentManually } from "@/server/gmail/dispatch";
import { api, parseBody } from "@/server/http";
import { lintForMessage } from "@/server/services/composer";
import { approve, getMessage } from "@/server/services/messages";

/**
 * "Wysłane": you sent the email from your own mailbox. A draft is approved on the way (warnings are
 * accepted by this click; blockers such as an opt-out or an invalid address still stop it), so the
 * record keeps exactly the text that was sent.
 */
export const POST = api<{ id: string }>(async (req, { params }) => {
  const { sentAt } = await parseBody(req, z.object({ sentAt: z.string().datetime().optional() }));
  const m = await getMessage(params.id);
  if (m.status === "draft" || m.status === "failed") {
    await approve(params.id, { acknowledgeWarnings: true, lint: await lintForMessage(m) });
  }
  await markSentManually(params.id, sentAt ? new Date(sentAt) : new Date());
  return { ok: true };
});
