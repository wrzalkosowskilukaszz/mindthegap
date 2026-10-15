import { api } from "@/server/http";
import { disconnect } from "@/server/gmail/oauth";

export const POST = api(async () => {
  await disconnect();
  return { ok: true };
});
