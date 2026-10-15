/** Route-handler helpers: session check, JSON parsing with Zod, uniform errors. */
import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { assertApiSession, UnauthorizedError } from "./auth/session.ts";
import { logEvent } from "./events.ts";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Nie znaleziono") => new HttpError(404, what);
export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const conflict = (msg: string, details?: unknown) => new HttpError(409, msg, details);

type Ctx<P> = { params: Promise<P> };

export function api<P = Record<string, never>>(
  fn: (req: Request, ctx: { params: P }) => Promise<unknown>,
  opts: { public?: boolean } = {},
) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      if (!opts.public) await assertApiSession(req.method);
      const params = ctx?.params ? await ctx.params : ({} as P);
      const result = await fn(req, { params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  if (err instanceof HttpError) return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
  if (err instanceof ZodError) {
    return NextResponse.json({ error: "Nieprawidłowe dane", details: err.issues.map((i) => ({ path: i.path, message: i.message })) }, { status: 400 });
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error("[api] unhandled", message);
  void logEvent("error", "api", "Nieobsłużony błąd serwera", { message: message.slice(0, 500) }).catch(() => {});
  return NextResponse.json({ error: "Błąd serwera. Szczegóły w dzienniku zdarzeń." }, { status: 500 });
}

export async function parseBody<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest("Oczekiwano JSON");
  }
  return schema.parse(json);
}

export function searchParams(req: Request): URLSearchParams {
  return new URL(req.url).searchParams;
}
