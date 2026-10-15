/**
 * Test environment: unit tests need no database. Integration tests (tests/*.int.test.ts) use
 * TEST_DATABASE_URL — a disposable database — and are skipped when it is not set.
 */
import { readFileSync } from "node:fs";

// Local convenience: pick up TEST_DATABASE_URL from .env.local when present (CI sets it explicitly).
if (!process.env.TEST_DATABASE_URL) {
  try {
    const m = readFileSync(".env.local", "utf8").match(/^TEST_DATABASE_URL=(.+)$/m);
    if (m?.[1]) process.env.TEST_DATABASE_URL = m[1].trim();
  } catch {
    /* no local env */
  }
}
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgres://invalid/none";
process.env.SESSION_SECRET ??= "test-session-secret-0123456789abcdef0123456789";
process.env.TOKEN_ENCRYPTION_KEY ??= "test-token-key-0123456789abcdef0123456789";
process.env.CRON_SECRET ??= "test-cron-secret";
process.env.APP_URL ??= "http://localhost:3000";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.HUNTER_API_KEY;
delete process.env.TAVILY_API_KEY;
