import { api, HttpError } from "@/server/http";
import { sendMessage } from "@/server/gmail/dispatch";

export const maxDuration = 120;

export const POST = api<{ id: string }>(async (_req, { params }) => {
  const r = await sendMessage(params.id);
  if (r.status === "blocked" || r.status === "deferred") throw new HttpError(409, r.message);
  return r;
});
