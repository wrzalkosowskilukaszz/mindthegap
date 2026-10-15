import { disconnect } from "@/server/gmail/oauth";
import { api } from "@/server/http";

export const POST = api(async () => {
  await disconnect();
  return { ok: true };
});
