import { describe, expect, it } from "vitest";
import { assessRole, functionFor, spreadAcrossFunctions } from "./roles.ts";

describe("assessRole", () => {
  it.each([
    ["Head of Learning & Development", "decision_maker", "learning"],
    ["Chief Learning Officer", "decision_maker", "learning"],
    ["Dyrektor Personalny", "decision_maker", "hr"],
    ["HR Director", "decision_maker", "hr"],
    ["People & Culture Director", "decision_maker", "hr"],
    ["Członek Zarządu ds. Personalnych", "decision_maker", "hr"],
    ["Dyrektor ds. rozwoju organizacji", "decision_maker", "learning"],
    ["Kierownik Akademii Lidera", "decision_maker", "learning"],
    ["Kierownik ds. szkoleń", "organizer_influencer", "learning"],
    ["Menedżer ds. szkoleń i rozwoju", "organizer_influencer", "learning"],
    ["Kierownik ds. rozwoju pracowników", "organizer_influencer", "learning"],
    ["HR Business Partner", "organizer_influencer", "hr"],
    ["Learning Partner", "organizer_influencer", "learning"],
    // Business leaders who sponsor and fund manager / team development
    ["Chief Operating Officer", "decision_maker", "business_leadership"],
    ["Dyrektor Operacyjny", "decision_maker", "business_leadership"],
    ["Site Lead, Kraków Delivery Center", "decision_maker", "business_leadership"],
    ["Dyrektor Zakładu w Kutnie", "decision_maker", "business_leadership"],
    ["Country Manager Poland", "decision_maker", "business_leadership"],
    ["Dyrektor Generalny", "decision_maker", "business_leadership"],
    // Transformation / change: the human side of AI adoption
    ["Chief Transformation Officer", "decision_maker", "transformation"],
    ["Head of AI Adoption", "decision_maker", "transformation"],
    ["Dyrektor ds. Transformacji Cyfrowej", "decision_maker", "transformation"],
    ["Change Manager", "organizer_influencer", "transformation"],
    // Culture / engagement
    ["Employee Experience Manager", "organizer_influencer", "people_culture"],
    ["Talent Management Specialist", "organizer_influencer", "people_culture"],
    // Procurement: indirect / services buyers and procurement leadership
    ["Indirect Procurement Manager", "organizer_influencer", "procurement"],
    ["Category Manager HR Services", "organizer_influencer", "procurement"],
    ["Kupiec usług nieprodukcyjnych", "organizer_influencer", "procurement"],
    ["Specjalista ds. zakupów usług", "organizer_influencer", "procurement"],
    ["Dyrektor ds. Zakupów", "organizer_influencer", "procurement"],
    ["Head of Procurement", "organizer_influencer", "procurement"],
    ["Strategic Sourcing Manager", "organizer_influencer", "procurement"],
  ])("%s → %s / %s", (title, category, fn) => {
    const r = assessRole(title);
    expect(r.category).toBe(category);
    expect(r.fn).toBe(fn);
    expect(r.relevant).toBe(true);
  });

  it.each([
    "Talent Acquisition Manager",
    "Senior Recruiter",
    "Specjalista ds. płac",
    "Dyrektor ds. Badań i Rozwoju",
    "Business Development Director",
    "Senior Software Developer",
    "Prezes Zarządu",
    // Look-alikes that are not training buyers
    "Kierownik zmiany", // shift supervisor
    "Dyrektor Oddziału", // bank branch
    "Customer Engagement Manager",
    "Category Manager Nabiał", // retail goods category
    "Kupiec asortymentu odzieżowego",
    "Specjalista ds. zakupów", // usually direct materials; not enough on its own
    "Merchandise Buyer",
  ])("does not treat %s as a development buyer", (title) => {
    expect(assessRole(title).relevant).toBe(false);
  });

  it("keeps an academy director even when the title also mentions R&D", () => {
    expect(assessRole("Dyrektor ds. Badań i Rozwoju Technicznego i Dyrektor BIO Akademii").relevant).toBe(
      true,
    );
  });
});

describe("functionFor", () => {
  it("uses the title, then the department, then the mailbox", () => {
    expect(functionFor("HR Business Partner", null)).toBe("hr");
    expect(functionFor(null, "Dział Zakupów")).toBe("procurement");
    expect(functionFor(null, null, "development")).toBe("learning");
    expect(functionFor(null, null, "procurement")).toBe("procurement");
    expect(functionFor(null, "Kontakt ogólny", "generic")).toBe("other");
  });
});

describe("spreadAcrossFunctions", () => {
  it("gives every department one slot before any gets a second", () => {
    const items = [
      { n: "hr1", f: "hr" },
      { n: "hr2", f: "hr" },
      { n: "hr3", f: "hr" },
      { n: "buy1", f: "procurement" },
      { n: "ops1", f: "business_leadership" },
    ];
    expect(spreadAcrossFunctions(items, (i) => i.f).map((i) => i.n)).toEqual([
      "hr1",
      "buy1",
      "ops1",
      "hr2",
      "hr3",
    ]);
  });
});
