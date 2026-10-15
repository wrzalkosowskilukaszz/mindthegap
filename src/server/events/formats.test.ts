import { describe, expect, it } from "vitest";
import { eventsFromIcal, eventsFromJsonLd } from "./formats.ts";

describe("event formats", () => {
  it("reads schema.org events from a page, with place, online mode and price", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BusinessEvent",
          name: "HR &amp; L&D Breakfast",
          startDate: "2026-11-05T09:00",
          endDate: "2026-11-05T11:00",
          url: "https://example.org/events/hr-breakfast",
          location: {
            "@type": "Place",
            name: "Centrum Konferencyjne",
            address: { addressLocality: "Warszawa" },
          },
          organizer: { "@type": "Organization", name: "Izba X" },
          offers: { "@type": "Offer", price: "0", priceCurrency: "PLN" },
          description: "<p>Spotkanie dla dyrektorów HR</p>",
        },
        {
          "@type": "Event",
          name: "Webinar: feedback w zespole",
          startDate: "2026-11-10T12:00:00+01:00",
          eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
          location: { "@type": "VirtualLocation", url: "https://zoom.us/x" },
        },
        { "@type": "Event", name: "No date" },
      ],
    })}</script>`;
    const ev = eventsFromJsonLd(html, "https://example.org/events/");
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({
      title: "HR & L&D Breakfast",
      place: "Centrum Konferencyjne, Warszawa",
      online: false,
      organiser: "Izba X",
      price: "bezpłatne",
      description: "Spotkanie dla dyrektorów HR",
      externalId: "https://example.org/events/hr-breakfast",
    });
    expect(ev[0]!.startsAt.toISOString()).toBe("2026-11-05T08:00:00.000Z");
    expect(ev[1]).toMatchObject({ online: true, place: null, url: "https://example.org/events/" });
    expect(ev[1]!.startsAt.toISOString()).toBe("2026-11-10T11:00:00.000Z");
  });

  it("reads an iCalendar feed with folded lines, time zones and escapes", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:abc-1@example.org",
      "SUMMARY:Konferencja Learning\\, Development & HR",
      "DTSTART;TZID=Europe/Warsaw:20261120T090000",
      "DTEND;TZID=Europe/Warsaw:20261120T170000",
      "LOCATION:Hotel X\\, Warszawa",
      "DESCRIPTION:Dla menedżerów HR\\nprogram:",
      "  sesje i networking",
      "URL:https://example.org/konf",
      "ORGANIZER;CN=Stowarzyszenie Y:mailto:biuro@example.org",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "SUMMARY:Webinar",
      "DTSTART:20261201T100000Z",
      "LOCATION:https://teams.microsoft.com/x",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const ev = eventsFromIcal(ics, "https://example.org/feed.ics");
    expect(ev[0]).toMatchObject({
      externalId: "abc-1@example.org",
      title: "Konferencja Learning, Development & HR",
      place: "Hotel X, Warszawa",
      url: "https://example.org/konf",
      organiser: "Stowarzyszenie Y",
      online: false,
    });
    expect(ev[0]!.description).toBe("Dla menedżerów HR\nprogram: sesje i networking");
    expect(ev[0]!.startsAt.toISOString()).toBe("2026-11-20T08:00:00.000Z");
    expect(ev[1]).toMatchObject({ online: true, place: null, url: "https://example.org/feed.ics" });
    expect(ev[1]!.startsAt.toISOString()).toBe("2026-12-01T10:00:00.000Z");
  });
});
