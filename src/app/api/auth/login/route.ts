import { z } from "zod";
import { login } from "@/server/auth/session";
import { api, HttpError, parseBody } from "@/server/http";

export const POST = api(
  async (req) => {
    const { password } = await parseBody(req, z.object({ password: z.string().min(1).max(500) }));
    const r = await login(password);
    if (r.ok) return { ok: true };
    if (r.error === "not_configured") throw new HttpError(503, "Hasło nie jest skonfigurowane (APP_PASSWORD_HASH).");
    if (r.error === "rate_limited") throw new HttpError(429, "Zbyt wiele prób. Spróbuj ponownie za 15 minut.");
    throw new HttpError(401, "Nieprawidłowe hasło.");
  },
  { public: true },
);
