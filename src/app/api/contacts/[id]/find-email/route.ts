import { enrichPerson } from "@/server/discovery/enrich";
import { api, badRequest } from "@/server/http";
import { BudgetExceededError } from "@/server/jobs/budget";

export const maxDuration = 60;

/** Looks up a named person's address with the configured provider (budgeted; found-only by default). */
export const POST = api<{ id: string }>(async (_req, { params }) => {
  try {
    const r = await enrichPerson(params.id, {});
    const message = {
      found: "Znaleziono adres — sprawdź jego źródła w panelu.",
      not_found: "Dostawca nie zna adresu tej osoby (bez opłaty).",
      skipped: r.detail
        ? `Pominięto: ${r.detail}.`
        : "Pominięto: kontakt ma już adres albo brakuje imienia i nazwiska.",
      not_configured: "Dostawca danych nie jest skonfigurowany (HUNTER_API_KEY).",
    }[r.status];
    return { status: r.status, message };
  } catch (e) {
    if (e instanceof BudgetExceededError) throw badRequest(e.message);
    throw e;
  }
});
