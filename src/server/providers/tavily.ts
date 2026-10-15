/** Tavily search adapter (discovery of public pages). Docs: https://docs.tavily.com/documentation/api-reference/endpoint/search */
import { providerJson } from "./http.ts";
import { ProviderError, type SearchResult, type WebSearch } from "./types.ts";

export class TavilySearch implements WebSearch {
  readonly name = "tavily";
  readonly creditsPerQuery = 1; // basic search
  constructor(private apiKey: string) {}

  async search(query: string, opts: { count?: number; country?: string } = {}): Promise<SearchResult[]> {
    const { status, data } = await providerJson<{
      results?: { url: string; title: string; content: string; published_date?: string }[];
      detail?: unknown;
    }>(this.name, "https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        query,
        max_results: opts.count ?? 8,
        search_depth: "basic",
        ...(opts.country ? { country: opts.country } : {}),
      }),
      timeoutMs: 30_000,
    });
    if (status >= 400) throw new ProviderError(this.name, `HTTP ${status}`, false, status);
    return (data.results ?? []).map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.content,
      age: r.published_date ?? null,
    }));
  }
}
