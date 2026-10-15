/** Operational log for things the owner may need to act on (shown in Aktywność / Kontakty). */
import { db } from "./db/client.ts";
import { appEvents } from "./db/schema.ts";

export type Level = "info" | "warning" | "error";

/** Never put personal data or secrets in `context`; keep ids and short technical messages only. */
export async function logEvent(
  level: Level,
  category: string,
  message: string,
  context: Record<string, unknown> = {},
  runId?: string | null,
): Promise<void> {
  try {
    await db()
      .insert(appEvents)
      .values({ level, category, message, context, runId: runId ?? null });
  } catch (e) {
    console.error("[events] failed to log", message, e instanceof Error ? e.message : e);
  }
}
