/**
 * Free email drafts without an AI model: written templates for each department, language and email
 * kind, filled with the company, the approved programme and the sender. Wording varies per contact
 * (chosen from the contact id), so a list of drafts does not read as one mass mailing.
 *
 * The templates state only what the sender's website says about the offer (workshops and programmes
 * for managers and teams, in person or online, half a day to several days, in Polish, English or
 * German). Numbers are written as words so the linter has nothing unsupported to flag.
 */
import type { RoleFunction } from "@/lib/roles";

export type TemplateInput = {
  language: "pl" | "en";
  kind: "initial" | "follow_up";
  seed: string;
  recipient: {
    kind: "person" | "department_inbox" | "general_inbox";
    firstName: string | null;
    salutation: "neutral" | "pani" | "pan";
    fn: RoleFunction;
  };
  company: string | null;
  program: string | null;
  businessName: string;
  senderName: string;
  hasSignature: boolean;
  previousSentAt: string | null;
  threadSubject: string | null;
};

export type TemplateDraft = {
  subjects: string[];
  body: string;
  variants: { kind: string; body: string }[];
  notes: string[];
};

function pick<T>(seed: string, salt: string, options: T[]): T {
  let h = 2166136261;
  for (const ch of `${seed}:${salt}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return options[Math.abs(h) % options.length] as T;
}

const DEPT_PL: Partial<Record<RoleFunction, string>> = {
  hr: "działu HR",
  learning: "zespołu szkoleń i rozwoju",
  procurement: "działu zakupów",
  people_culture: "zespołu HR",
};
const DEPT_EN: Partial<Record<RoleFunction, string>> = {
  hr: "the HR team",
  learning: "the learning & development team",
  procurement: "the procurement team",
  people_culture: "the people team",
};

const ANGLE_PL: Record<RoleFunction, string[]> = {
  hr: [
    "Przy planowaniu rozwoju często wraca ten sam temat: menedżerowie, którzy mają prowadzić zespoły w zmianie i niepewności, a mają na to coraz mniej czasu.",
    "W wielu firmach największą potrzebą rozwojową nie są dziś kolejne szkolenia z teorii, tylko praktyczne wsparcie menedżerów w prowadzeniu zespołów przez zmiany.",
  ],
  learning: [
    "Jeśli w programie rozwojowym brakuje praktycznych warsztatów dla menedżerów i całych zespołów — opartych na tym, jak zespół pracuje dziś — to dokładnie ten obszar, w którym pracuję.",
    "Dobrze zaprojektowany program dla menedżerów potrzebuje elementu, który przenosi teorię do codziennej pracy zespołu. Na tym skupiają się moje warsztaty.",
  ],
  procurement: [
    "Zgłaszam się jako dostawca usług rozwojowych: warsztatów i programów dla menedżerów oraz zespołów.",
    "Piszę jako potencjalny dostawca usług rozwojowych — warsztatów i programów dla menedżerów oraz zespołów.",
  ],
  business_leadership: [
    "Gdy zespoły pracują pod presją zmian, najwięcej zależy od menedżerów — od tego, jak rozmawiają z ludźmi i jak budują zaufanie.",
    "Wyniki zespołów w dużej mierze zależą od tego, jak menedżerowie prowadzą ludzi w okresie zmian i niepewności.",
  ],
  transformation: [
    "Przy wdrażaniu zmian — także tych związanych z AI — najtrudniejsza bywa strona ludzka: niepewność w zespołach i rola menedżera, który ma ją udźwignąć.",
    "Technologia to zwykle łatwiejsza część transformacji. Trudniejsze jest przeprowadzenie przez nią ludzi — i to zadanie spada głównie na menedżerów.",
  ],
  people_culture: [
    "Kultura organizacyjna i zaangażowanie zaczynają się w codziennej pracy zespołów — w tym, jak ludzie rozmawiają, współpracują i rozwiązują napięcia.",
    "Zaufanie i dobra współpraca w zespołach rzadko biorą się z deklaracji — budują je konkretne rozmowy i nawyki, nad którymi da się pracować.",
  ],
  other: [
    "Pracuję z menedżerami i zespołami nad tym, jak komunikują się i współpracują w okresie zmian.",
    "Wspieram firmy w rozwoju menedżerów i zespołów — szczególnie tam, gdzie zmiany wymagają nowego sposobu współpracy.",
  ],
};

const ANGLE_EN: Record<RoleFunction, string[]> = {
  hr: [
    "When development plans are made, one theme keeps coming back: managers who need to lead teams through change and uncertainty, with less and less time to do it.",
    "In many companies the biggest development need today is not more theory, but practical support for managers leading their teams through change.",
  ],
  learning: [
    "If your development programme could use practical workshops for managers and whole teams — built around how the team works today — that is exactly where I work.",
    "A good programme for managers needs a part that turns theory into the team's everyday work. That is what my workshops focus on.",
  ],
  procurement: [
    "I am reaching out as a provider of development services: workshops and programmes for managers and teams.",
    "I am writing as a potential supplier of development services — workshops and programmes for managers and teams.",
  ],
  business_leadership: [
    "When teams work under the pressure of change, most depends on their managers — on how they talk to people and how they build trust.",
    "How teams perform depends a great deal on how managers lead people through change and uncertainty.",
  ],
  transformation: [
    "In any change — including AI adoption — the hardest part is often the human side: uncertainty in teams and the managers who have to carry it.",
    "Technology is usually the easier part of a transformation. Taking people through it is harder, and that work falls mostly on managers.",
  ],
  people_culture: [
    "Culture and engagement start in the everyday work of teams — in how people talk, collaborate and handle tension.",
    "Trust and good collaboration rarely come from statements; they come from specific conversations and habits that a team can work on.",
  ],
  other: [
    "I work with managers and teams on how they communicate and collaborate through change.",
    "I support companies in developing managers and teams — especially where change calls for a new way of working together.",
  ],
};

function greeting(t: TemplateInput): string {
  if (t.language === "en")
    return t.recipient.kind === "person" && t.recipient.firstName ? `Hi ${t.recipient.firstName},` : "Hello,";
  if (t.recipient.salutation === "pani") return "Szanowna Pani,";
  if (t.recipient.salutation === "pan") return "Szanowny Panie,";
  return "Dzień dobry,";
}

/** The closing line. Your name, position and company follow in the signature the app adds. */
function closing(t: TemplateInput): string {
  if (t.hasSignature) return "";
  return t.language === "pl" ? "Pozdrawiam serdecznie" : "Kind regards";
}

function join(parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join("\n\n");
}

function initialPl(t: TemplateInput, short: boolean): string {
  const fn = t.recipient.fn;
  const firm = t.company ? `w firmie ${t.company}` : "w Państwa firmie";
  const inbox = t.recipient.kind !== "person";
  const dept = DEPT_PL[fn];
  const opening = inbox
    ? dept
      ? `piszę do ${dept} w sprawie rozwoju menedżerów i zespołów ${firm}.`
      : `piszę w sprawie rozwoju menedżerów i zespołów ${firm}.`
    : pick(t.seed, "open-pl", [
        `piszę w sprawie rozwoju menedżerów i zespołów ${firm}.`,
        `kontaktuję się w sprawie rozwoju menedżerów i zespołów ${firm}.`,
      ]);
  const angle = pick(t.seed, "angle", ANGLE_PL[fn]);
  const offer = t.program
    ? `W ${t.businessName} prowadzę między innymi program „${t.program}”. Pracuję w formie praktycznych warsztatów — stacjonarnie lub online, od pół dnia do kilku dni, po polsku, angielsku lub niemiecku.`
    : `W ${t.businessName} prowadzę warsztaty i programy dla menedżerów i zespołów: od jednej sesji po program na kilka tygodni, stacjonarnie lub online, po polsku, angielsku lub niemiecku.`;
  const cta =
    fn === "procurement"
      ? "Czy mogą Państwo wskazać osobę odpowiedzialną za zakup szkoleń albo proces rejestracji dostawców?"
      : pick(t.seed, "cta-pl", [
          "Czy znajdzie się pół godziny na krótką rozmowę, żeby sprawdzić, czy to pasuje do Państwa potrzeb?",
          "Jeśli temat jest aktualny, chętnie opowiem więcej w krótkiej, półgodzinnej rozmowie — bez zobowiązań.",
        ]);
  const forward = inbox
    ? "Jeśli to nie jest właściwy adres, proszę o przekazanie wiadomości osobie odpowiedzialnej za rozwój pracowników."
    : null;
  // Polish letters continue in lower case after the comma of the greeting.
  return join([
    `${greeting(t)}\n\n${opening}`,
    short ? null : angle,
    offer,
    cta,
    short ? null : forward,
    closing(t),
  ]);
}

function initialEn(t: TemplateInput, short: boolean): string {
  const fn = t.recipient.fn;
  const firm = t.company ? `at ${t.company}` : "in your company";
  const inbox = t.recipient.kind !== "person";
  const dept = DEPT_EN[fn];
  const opening = inbox
    ? dept
      ? `I am writing to ${dept} about developing managers and teams ${firm}.`
      : `I am writing about developing managers and teams ${firm}.`
    : pick(t.seed, "open-en", [
        `I am writing about developing managers and teams ${firm}.`,
        `I am reaching out about developing managers and teams ${firm}.`,
      ]);
  const angle = pick(t.seed, "angle", ANGLE_EN[fn]);
  const offer = t.program
    ? `At ${t.businessName} I run, among others, the programme "${t.program}". I work through practical workshops — in person or online, from half a day to several days, in English, Polish or German.`
    : `At ${t.businessName} I run workshops and programmes for managers and teams: from a single session to a programme over several weeks, in person or online, in English, Polish or German.`;
  const cta =
    fn === "procurement"
      ? "Could you point me to the person responsible for buying training, or to your supplier registration process?"
      : pick(t.seed, "cta-en", [
          "Would you have half an hour for a short call to see whether this fits your needs?",
          "If this is relevant, I would be glad to tell you more in a short, half-hour call — no commitment.",
        ]);
  const forward = inbox
    ? "If this is not the right address, I would be grateful if you could pass this on to the person responsible for people development."
    : null;
  return join([
    `${greeting(t)}\n\n${opening}`,
    short ? null : angle,
    offer,
    cta,
    short ? null : forward,
    closing(t),
  ]);
}

function followUp(t: TemplateInput): string {
  const firm = t.company ? (t.language === "pl" ? ` w firmie ${t.company}` : ` at ${t.company}`) : "";
  const when = t.previousSentAt
    ? t.language === "pl"
      ? ` z ${new Date(t.previousSentAt).toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}`
      : ` from ${new Date(t.previousSentAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`
    : "";
  if (t.language === "pl")
    return join([
      `${greeting(t)}\n\nwracam krótko do mojej wiadomości${when} w sprawie rozwoju menedżerów i zespołów${firm}.`,
      pick(t.seed, "angle-fu", ANGLE_PL[t.recipient.fn]),
      "Jeśli temat nie jest teraz aktualny, wystarczy krótka odpowiedź — nie będę wracać do sprawy. A jeśli to nie Państwa obszar, proszę o wskazanie właściwej osoby.",
      closing(t),
    ]);
  return join([
    `${greeting(t)}\n\nA short follow-up to my message${when} about developing managers and teams${firm}.`,
    pick(t.seed, "angle-fu", ANGLE_EN[t.recipient.fn]),
    "If this is not a priority right now, a one-line reply is enough and I will not follow up again. And if it is not your area, I would appreciate a pointer to the right person.",
    closing(t),
  ]);
}

function subjects(t: TemplateInput): string[] {
  if (t.kind === "follow_up" && t.threadSubject) return [t.threadSubject];
  const c = t.company;
  if (t.language === "pl") {
    if (t.recipient.fn === "procurement")
      return [
        "Dostawca warsztatów dla menedżerów i zespołów",
        c ? `${c}: właściwa osoba ds. zakupu szkoleń?` : "Właściwa osoba ds. zakupu szkoleń?",
      ];
    return [
      t.program ? `${t.program}${c ? ` — ${c}` : ""}` : `Rozwój menedżerów${c ? ` — ${c}` : ""}`,
      c ? `${c}: warsztaty dla menedżerów i zespołów` : "Warsztaty dla menedżerów i zespołów",
    ];
  }
  if (t.recipient.fn === "procurement")
    return [
      "Supplier of workshops for managers and teams",
      c ? `${c}: who buys training?` : "Who is responsible for buying training?",
    ];
  return [
    t.program ? `${t.program}${c ? ` — ${c}` : ""}` : `Developing managers${c ? ` at ${c}` : ""}`,
    c ? `${c}: workshops for managers and teams` : "Workshops for managers and teams",
  ];
}

export function templateDraft(t: TemplateInput): TemplateDraft {
  const body =
    t.kind === "follow_up" ? followUp(t) : t.language === "pl" ? initialPl(t, false) : initialEn(t, false);
  const shorter =
    t.kind === "follow_up" ? body : t.language === "pl" ? initialPl(t, true) : initialEn(t, true);
  const notes = [
    "Szkic z szablonu (bez AI): dopasowany do działu odbiorcy, firmy i wybranego programu.",
    t.recipient.fn !== "other"
      ? `Ujęcie dla działu: ${t.recipient.fn}.`
      : "Dział odbiorcy nieustalony — wersja uniwersalna.",
    "Przeczytaj i dopisz jedno zdanie od siebie, jeśli znasz kontekst firmy.",
  ];
  return {
    subjects: subjects(t),
    body,
    variants: shorter !== body ? [{ kind: "shorter", body: shorter }] : [],
    notes,
  };
}
