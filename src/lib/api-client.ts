/** Browser-side JSON client for our route handlers. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
    cache: "no-store",
  });
  if (res.status === 401) {
    window.location.assign("/login");
    throw new ApiError(401, "Sesja wygasła");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; details?: unknown };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Błąd ${res.status}`, data.details);
  return data as T;
}
