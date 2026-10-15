/** fetch with timeout, explicit proxy support (HTTPS_PROXY) and uniform provider errors. */
import { ProviderError, RateLimitedError } from "./types.ts";

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;
let fetchPromise: Promise<FetchFn> | null = null;

/**
 * Node's global fetch ignores HTTPS_PROXY. When a proxy is configured (e.g. a sandbox), use undici's own
 * fetch with EnvHttpProxyAgent; otherwise the global fetch.
 */
function getFetch(): Promise<FetchFn> {
  if (!fetchPromise) {
    const proxied = Boolean(process.env.HTTPS_PROXY || process.env.https_proxy);
    fetchPromise = proxied
      ? import("undici")
          .then((u) => {
            const agent = new u.EnvHttpProxyAgent();
            return ((url: string, init: RequestInit) => u.fetch(url, { ...(init as object), dispatcher: agent } as never) as unknown as Promise<Response>) as FetchFn;
          })
          .catch(() => globalThis.fetch.bind(globalThis))
      : Promise.resolve(globalThis.fetch.bind(globalThis));
  }
  return fetchPromise;
}

export async function httpFetch(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 20_000);
  try {
    const f = await getFetch();
    const { timeoutMs: _t, ...rest } = init;
    return await f(url, { ...rest, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function providerJson<T>(provider: string, url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<{ status: number; data: T }> {
  let res: Response;
  try {
    res = await httpFetch(url, init);
  } catch (e) {
    throw new ProviderError(provider, `network: ${e instanceof Error ? e.message : String(e)}`, true);
  }
  if (res.status === 429) {
    const ra = Number(res.headers.get("retry-after") ?? "0");
    throw new RateLimitedError(provider, (Number.isFinite(ra) && ra > 0 ? ra : 30) * 1000);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { nonJson: text.slice(0, 300) };
  }
  if (res.status >= 500) throw new ProviderError(provider, `HTTP ${res.status}`, true, res.status);
  if (res.status === 401 || res.status === 403) throw new ProviderError(provider, `HTTP ${res.status}: unauthorized`, false, res.status);
  return { status: res.status, data: data as T };
}
