import { describe, expect, it } from "vitest";
import { careerLinks, findBoards } from "./detect.ts";
import { htmlToText } from "./text.ts";

describe("careers detection", () => {
  it("recognises the job-board systems behind career pages", () => {
    const html = `
      <a href="https://boards.greenhouse.io/acme">Jobs</a>
      <script src="https://boards.greenhouse.io/embed/job_board/js?for=acme"></script>
      <a href="https://jobs.lever.co/beta-co/123">Role</a>
      <a href="https://roche.wd3.myworkdayjobs.com/pl-PL/roche-ext">Kariera</a>
      <a href="https://career5.successfactors.eu/career?company=lidlstiftuP2">Praca</a>
      <a href="https://acme.recruitee.com/o/x">x</a>`;
    const b = findBoards(html).map((x) => `${x.kind}:${x.token}:${x.supported}`);
    expect(b).toEqual(
      expect.arrayContaining([
        "greenhouse:acme:true",
        "lever:beta-co:true",
        "workday:roche|wd3|roche-ext:true",
        "successfactors:career5.successfactors.eu/career?company=lidlstiftuP2:false",
        "recruitee:acme:true",
      ]),
    );
  });

  it("finds careers links on a home page and skips social sites", () => {
    const html = `
      <a href="/o-nas">O nas</a>
      <a href="/kariera">Kariera</a>
      <a href="https://www.linkedin.com/company/acme/jobs">LinkedIn</a>
      <a href="https://kariera.acme.pl/">Dołącz do nas</a>`;
    const links = careerLinks(html, "https://www.acme.pl/");
    expect(links[0]).toBe("https://kariera.acme.pl/");
    expect(links).toContain("https://www.acme.pl/kariera");
    expect(links.some((l) => l.includes("linkedin"))).toBe(false);
  });

  it("turns ad HTML (also escaped HTML) into readable text", () => {
    expect(htmlToText("<p>Hello</p><ul><li>One</li><li>Two</li></ul><script>x()</script>")).toBe(
      "Hello\n\n• One\n• Two",
    );
    expect(htmlToText("&lt;p&gt;Escaped &amp;amp; fine&lt;/p&gt;")).toBe("Escaped & fine");
  });
});
