import { describe, expect, it } from "vitest";
import { jobLinks, jobPostingsIn, toRawJob } from "./jsonld.ts";

const page = `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Acme"},
{"@type":"JobPosting","title":"Learning &amp; Development Partner","description":"<p>Lead <b>workshops</b></p><ul><li>Facilitation</li></ul>",
"datePosted":"2026-10-01","employmentType":["FULL_TIME"],"hiringOrganization":{"@type":"Organization","name":"Acme Polska"},
"jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Warszawa","addressCountry":"PL"}},
"identifier":{"@type":"PropertyValue","value":"REQ-123"}}]}</script>
<script type="application/ld+json">{ broken json </script>
</head><body>
<a href="/kariera/oferta/learning-development-partner-123">Learning & Development Partner</a>
<a href="/kariera/oferty">Wszystkie oferty</a>
<a href="https://www.linkedin.com/jobs/view/123">LinkedIn</a>
<a href="https://other.com/jobs/abc-def-ghi">Elsewhere</a>
</body></html>`;

describe("career pages with JobPosting data", () => {
  it("reads job postings from @graph and skips broken blocks", () => {
    const posts = jobPostingsIn(page);
    expect(posts).toHaveLength(1);
    const j = toRawJob(posts[0]!, "https://acme.pl/kariera", "Acme");
    expect(j).toMatchObject({
      externalId: "REQ-123",
      title: "Learning & Development Partner",
      companyName: "Acme Polska",
      location: "Warszawa, PL",
      employmentType: "FULL_TIME",
      url: "https://acme.pl/kariera",
    });
    expect(j?.description).toContain("• Facilitation");
    expect(j?.postedAt?.toISOString().slice(0, 10)).toBe("2026-10-01");
  });

  it("finds links to single offers on the same site only", () => {
    const links = jobLinks(page, "https://www.acme.pl/kariera");
    expect(links).toEqual([
      {
        url: "https://www.acme.pl/kariera/oferta/learning-development-partner-123",
        text: "Learning & Development Partner",
      },
    ]);
  });
});
