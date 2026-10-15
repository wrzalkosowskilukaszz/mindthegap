import { describe, expect, it, vi } from "vitest";
import type { PoliteFetcher } from "../discovery/fetcher.ts";
import { bkDate, bkDetail, bkSearch, bkUrl } from "./bk.ts";

const fetcher = (body: unknown, ct = "text/html; charset=UTF-8") =>
  ({
    get: vi.fn(async (url: string) => ({
      ok: true,
      url,
      status: 200,
      body: JSON.stringify(body),
      contentType: ct,
    })),
  }) as unknown as PoliteFetcher & { get: ReturnType<typeof vi.fn> };

describe("Baza Konkurencyjności reader", () => {
  it("reads a search page: strips highlight tags, parses Polish-time deadlines, asks only for published ones", async () => {
    const f = fetcher({
      status: "OK",
      data: {
        advertisements: [
          {
            id: 294913,
            title: "Nowoczesne NGO – <mark>Kompetencje</mark> &amp; współpraca",
            content: "Przedmiotem zamówienia jest <b>tutoring</b>",
            advertiser_name: "Fundacja X",
            publication_date: "2026-10-15",
            submission_deadline: "2026-10-23 08:00:00",
            fulfillment_place: "Cała Polska",
            favorite: null,
          },
        ],
        meta: { total: 1 },
      },
    });
    const r = await bkSearch(f, { trainingCategory: true, page: 1, limit: 100 });
    const url = new URL(f.get.mock.calls[0]![0] as string);
    expect(url.searchParams.get("status[]")).toBe("PUBLISHED");
    expect(url.searchParams.get("subcategory")).toBe("Usługi szkoleniowe");
    expect(r.total).toBe(1);
    expect(r.items[0]).toMatchObject({
      externalId: "294913",
      title: "Nowoczesne NGO – Kompetencje & współpraca",
      snippet: "Przedmiotem zamówienia jest tutoring",
      place: "Cała Polska",
      publishedOn: "2026-10-15",
    });
    expect(r.items[0]!.deadlineAt?.toISOString()).toBe("2026-10-23T06:00:00.000Z");
    expect(bkUrl("294913")).toBe("https://bazakonkurencyjnosci.funduszeeuropejskie.gov.pl/ogloszenia/294913");
  });

  it("rejects an unexpected answer instead of storing it", async () => {
    await expect(bkSearch(fetcher({ status: "Error" }), { page: 1, limit: 10 })).rejects.toThrow(
      "unexpected_shape",
    );
    expect(bkDate("not a date")).toBeNull();
  });

  it("reads the full text and conditions but never the contact persons", async () => {
    const d = await bkDetail(
      fetcher({
        status: "OK",
        data: {
          advertisement: {
            title: "Tutoring",
            submission_deadline: "2026-10-23 08:00:00",
            advertisement: { number: "2026-80297-294913" },
            advertiser_address_details: { address: { locality: "Cieszyn", voivodeship: "śląskie" } },
            contact_persons: [{ forename: "Jan", surname: "Kowalski", email: "jan@example.com" }],
            orders: [
              {
                title: "Tutoring",
                order_items: [
                  {
                    description: "Indywidualny tutoring dla 50 przedsiębiorstw.",
                    fulfillment_places: [{ country: "Polska", voivodeship: null, locality: null }],
                    participation_conditions: [
                      {
                        description: "Zamawiający nie ustanawia wymagań w tym obszarze",
                        type: { name: "Uprawnienia" },
                      },
                      {
                        description: "Min. 2 lata doświadczenia w tutoringu",
                        type: { name: "Doświadczenie" },
                      },
                    ],
                  },
                ],
                evaluation_criteria: [{ description: "Cena – 60 pkt" }],
              },
            ],
            attachments: [{ name: "zapytanie ofertowe.pdf" }],
          },
        },
      }),
      "294913",
    );
    expect(d).toMatchObject({
      description: "Indywidualny tutoring dla 50 przedsiębiorstw.",
      conditions: ["Doświadczenie: Min. 2 lata doświadczenia w tutoringu"],
      criteria: ["Cena – 60 pkt"],
      attachments: ["zapytanie ofertowe.pdf"],
      places: ["Polska"],
      advertiserCity: "Cieszyn, śląskie",
      number: "2026-80297-294913",
    });
    expect(JSON.stringify(d)).not.toContain("Kowalski");
  });
});
