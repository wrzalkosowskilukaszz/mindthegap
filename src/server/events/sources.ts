/**
 * Where Wydarzenia comes from. Every entry was checked on 2026-10-15: the page answers, robots.txt allows
 * it, and the format is as stated. Platforms whose terms or blocking forbid automated reading (Eventbrite
 * search, Meetup search and API, AllEvents, Crossweb, Evenea, 10times) and LinkedIn/Facebook are not here.
 *
 * - feed: a machine-readable list of events (schema.org Event data in the page, or an iCalendar feed).
 * - watch: a page without such data; the app notices when its dates change and shows the new lines.
 */
export type EventSourceDef = {
  key: string;
  name: string;
  url: string;
  kind: "feed" | "watch";
  format: "jsonld" | "ical" | "html";
  /** For watched pages: what it is, shown in the list. */
  note?: string;
};

export const EVENT_SOURCES: EventSourceDef[] = [
  // Feeds: read and listed event by event.
  // Organisers' own feeds come first: when an aggregator lists the same event, the organiser's data wins.
  { key: "kongreshr", name: "Kongres HR", url: "https://kongreshr.eu/", kind: "feed", format: "jsonld" },
  {
    key: "tomhrm",
    name: "tomHRM – kalendarz wydarzeń HR",
    url: "https://tomhrm.com/blog-hr/wydarzenia-hr/",
    kind: "feed",
    format: "jsonld",
  },
  {
    key: "meetup-talentuch",
    name: "Talentuch HR Community (Meetup)",
    url: "https://www.meetup.com/talentuchhrcommunity/events/ical/",
    kind: "feed",
    format: "ical",
  },
  {
    key: "emcc",
    name: "EMCC Poland",
    url: "https://emccpoland.org/events/?ical=1",
    kind: "feed",
    format: "ical",
  },
  {
    key: "digitalhr",
    name: "Digital HR – webinary",
    url: "https://digitalhr.pl/webinary-lista/?ical=1",
    kind: "feed",
    format: "ical",
  },

  // Conferences where L&D and HR buyers meet: one page each, watched for changes.
  {
    key: "elearning-fusion",
    name: "E-Learning Fusion",
    url: "https://elearning-fusion.pl/",
    kind: "watch",
    format: "html",
    note: "Konferencja L&D i e-learningu, ze strefą EXPO",
  },
  {
    key: "learning-impact",
    name: "Learning Impact",
    url: "https://learning-impact.pl/",
    kind: "watch",
    format: "html",
    note: "Konferencja L&D",
  },
  {
    key: "kongres-profesjonalistow-hr",
    name: "Kongres Profesjonalistów HR",
    url: "https://www.kongresprofesjonalistowhr.pl/",
    kind: "watch",
    format: "html",
    note: "Dla HR Business Partnerów i dyrektorów HR",
  },
  {
    key: "hr-week-warsaw",
    name: "HR Week Warsaw",
    url: "https://hrweek.eu/warsaw/",
    kind: "watch",
    format: "html",
    note: "Konferencja HR w Warszawie",
  },
  {
    key: "konkret",
    name: "KONKRET.",
    url: "https://www.konkret2026.pl/",
    kind: "watch",
    format: "html",
    note: "Konferencja HR / L&D",
  },
  {
    key: "todai-hr",
    name: "todAI HR",
    url: "https://aiadnakademia.pl/konferencja-ai-w-hr/",
    kind: "watch",
    format: "html",
    note: "AI w HR",
  },
  {
    key: "hr-trends",
    name: "HR Solutions Trends",
    url: "https://hrtrends.pl/",
    kind: "watch",
    format: "html",
    note: "Konferencja online",
  },
  {
    key: "hrm-institute",
    name: "HRM Institute",
    url: "https://hrminstitute.pl/",
    kind: "watch",
    format: "html",
    note: "Employer Branding Summit i wydarzenia o employer brandingu",
  },
  // Lists of many events: changes mean new announcements.
  {
    key: "hrpolska-patronat",
    name: "HRpolska – wydarzenia z patronatem",
    url: "https://hrpolska.pl/newsy/patronat-medialny",
    kind: "watch",
    format: "html",
    note: "Zapowiedzi konferencji HR",
  },
  {
    key: "hrlityczny",
    name: "hrlityczny.pl – konferencje HR",
    url: "https://hrlityczny.pl/ciekawe-konferencje-hr/",
    kind: "watch",
    format: "html",
    note: "Lista konferencji HR na ten rok",
  },
  {
    key: "icf",
    name: "ICF Polska – kalendarz",
    url: "https://icf.org.pl/wydarzenia-kalendarz/",
    kind: "watch",
    format: "html",
    note: "Spotkania coachów, także oddziału Mazowsze",
  },
  // Chambers of commerce: networking with managers of international companies in Warsaw.
  {
    key: "amcham",
    name: "AmCham Poland",
    url: "https://amcham.pl/events/",
    kind: "watch",
    format: "html",
    note: "Ma Komitet HR; spotkania w Warszawie",
  },
  {
    key: "ahk",
    name: "AHK Polska (izba polsko-niemiecka)",
    url: "https://www.ahk.pl/pl/events",
    kind: "watch",
    format: "html",
    note: "Śniadania i spotkania dla menedżerów",
  },
  {
    key: "spcc",
    name: "SPCC (izba polsko-szwedzka)",
    url: "https://spcc.pl/poznaj-nasze-wydarzenia/kalendarz-wydarzen/",
    kind: "watch",
    format: "html",
    note: "Networking, m.in. Speed Business Mixer",
  },
  {
    key: "ccifp",
    name: "CCI France Pologne",
    url: "https://www.ccifp.pl/wydarzenia.html",
    kind: "watch",
    format: "html",
    note: "Komitety i networking w Warszawie i Krakowie",
  },
];

/** Other ways to meet people who buy training. Checked 2026-10-15; details may change. */
export const OTHER_WAYS: { name: string; url: string; text: string }[] = [
  {
    name: "ICF Polska – oddział Mazowsze",
    url: "https://icf.org.pl/oddzialy/mazowsze/",
    text: "Spotkania coachów w Warszawie. Sesje edukacyjne prowadzą osoby z zewnątrz, więc możesz zaproponować własną.",
  },
  {
    name: "EMCC Poland",
    url: "https://emccpoland.org/",
    text: "Coaching i mentoring. Spotkania online dla nowych członków i cykl „Edukacja z EMCC”; szuka też wolontariuszy.",
  },
  {
    name: "PIFS – Polska Izba Firm Szkoleniowych",
    url: "https://pifs.org.pl/",
    text: "Izba branży szkoleniowej; organizuje coroczny kongres KEP (kep.com.pl).",
  },
  {
    name: "AmCham – Komitet HR",
    url: "https://amcham.pl/events/",
    text: "Spotkania dyrektorów HR firm międzynarodowych w Warszawie.",
  },
  {
    name: "ABSL – centra usług biznesowych",
    url: "https://absl.pl/en/initiatives/events",
    text: "Duzi kupujący szkolenia (m.in. HR Corner o L&D). Część wydarzeń jest tylko dla członków, a strony nie da się czytać automatycznie: sprawdzaj ją ręcznie.",
  },
  {
    name: "E-Learning Fusion – strefa EXPO",
    url: "https://elearning-fusion.pl/",
    text: "Na konferencji jest strefa wystawców dla firm szkoleniowych.",
  },
  {
    name: "BUR – Baza Usług Rozwojowych",
    url: "https://uslugirozwojowe.parp.gov.pl/",
    text: "Firmy kupują tu szkolenia z dofinansowaniem. Wpis jako dostawca wymaga spełnienia wymogów jakości (szczegóły na stronie PARP).",
  },
];
