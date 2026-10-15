/**
 * Server environment, validated once. Secrets live only here (never in client bundles).
 * Optional integrations are `undefined` when not configured; the UI reports them as
 * "awaiting configuration" instead of failing.
 */
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_PASSWORD_HASH: optional,
  SESSION_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
  CRON_SECRET: z.string().min(12),
  // AI
  ANTHROPIC_API_KEY: optional,
  AI_MODEL: z.string().default("claude-opus-5-5"),
  AI_MODEL_FAST: z.string().default("claude-opus-5-5"),
  // Contact data providers
  HUNTER_API_KEY: optional,
  // Web search for discovery (optional; Tavily recommended in docs/research/PROVIDERS.md)
  TAVILY_API_KEY: optional,
  // Google OAuth (Gmail)
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  // Safety switch: real sending must be explicitly enabled per deployment.
  SENDING_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  CRAWLER_CONTACT_URL: z.string().default("https://leadersmindthegap.com/"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Invalid server environment: ${fields}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** For tests only. */
export function resetEnvCache(): void {
  cached = undefined;
}

export function integrations() {
  const e = env();
  return {
    ai: Boolean(e.ANTHROPIC_API_KEY),
    hunter: Boolean(e.HUNTER_API_KEY),
    search: Boolean(e.TAVILY_API_KEY),
    google: Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET),
    sendingEnabled: e.SENDING_ENABLED,
  };
}
