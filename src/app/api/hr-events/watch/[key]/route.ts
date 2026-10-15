import { markSourceSeen } from "@/server/events/sync";
import { api } from "@/server/http";

/** The owner opened a watched page: its "new" mark goes away. */
export const POST = api<{ key: string }>(async (_req, { params }) => {
  await markSourceSeen(params.key);
  return { ok: true };
});
