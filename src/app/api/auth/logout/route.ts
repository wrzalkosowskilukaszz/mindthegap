import { logout } from "@/server/auth/session";
import { api } from "@/server/http";

export const POST = api(async () => {
  await logout();
  return { ok: true };
});
