# Who organises, buys and budgets training in a company

Research note, 2026-10-15. It explains which departments the app looks for and why. The rules that apply it are in `src/lib/roles.ts` (job titles), `src/lib/normalize.ts` (`classifyMailbox`, mailbox names) and `src/server/ai/compose.ts` (`ANGLE`, how the email adapts to the recipient's department).

**Evidence level.** The sources below are practitioner guides, vendor research and real job postings. They describe common practice, not a rule. Who decides varies by company, by country and by the size of the purchase. The app therefore labels each contact *likely* decision-maker or *likely* organiser. A published job title is never treated as proof of purchasing authority.

## The short answer

Buying training is usually a group decision. In a large company, five functions take part:

| Function (`role_function`) | What they do in a training purchase | Typical titles the app recognises |
|---|---|---|
| **HR / People** (`hr`) | Owns the annual training plan and usually the training budget. Collects needs from managers. Approves spend above certain amounts. | HR Director, Dyrektor Personalny, CHRO, VP People, HR Business Partner, HR Manager |
| **L&D / corporate academy** (`learning`) | Designs and runs programmes, picks trainers, champions a purchase to the budget holder. | Head of L&D, Chief Learning Officer, Kierownik ds. szkoleń, Akademia …, Learning Partner, Trainer |
| **Procurement** (`procurement`) | Runs the request for proposals (*zapytanie ofertowe*), qualifies suppliers, keeps the preferred-supplier list, negotiates the contract. In large companies training sits in an *indirect* or *HR / professional services* category. | Indirect Buyer, Category Manager HR Services, Kupiec usług nieprodukcyjnych, Dyrektor ds. Zakupów, Head of Procurement |
| **Business leaders** (`business_leadership`) | Sponsor development for their own managers and teams. Often hold or influence the budget for their unit, especially in plants, shared-service centres and country organisations. | COO, Dyrektor Operacyjny, Site Lead, Dyrektor Zakładu, Country Manager, Dyrektor Generalny |
| **Transformation / change** (`transformation`) | Own the human side of large changes, including AI adoption: a natural sponsor for *Leading Through the AI Shift*. | Chief Transformation Officer, Head of AI Adoption, Dyrektor ds. Transformacji, Change Manager |
| **Talent, culture, engagement** (`people_culture`) | Influence programmes on culture, trust and team effectiveness. | Talent Management, Employee Experience, Engagement, Culture Lead |

## Sources

- How a training plan is built: needs are collected from employees and managers, a plan is set, and a budget is assigned to it. [poradnikprzedsiebiorcy.pl, *Szkolenia dla pracowników: jak je sprawnie zaplanować*](https://poradnikprzedsiebiorcy.pl/-szkolenia-dla-pracownikow-jak-je-sprawnie-zaplanowac); [ClickUp, *Budżet na szkolenia pracowników*](https://clickup.com/pl/blog/519700/budzet-na-szkolenia-pracownikow).
- Several stakeholders take part: L&D focuses on learning quality and champions purchases; HR directors and senior managers hold budgets and look at cost-effectiveness; department heads care about fit with operations. [TechClass, *Buyer personas for corporate training*](https://www.techclass.com/resources/learning-and-development-articles/mastering-buyer-personas-for-corporate-training-and-lms-success-a-guide-for-l-and-d-leaders) (vendor guide). Planning often happens in Q3/Q4: [Guroo Academy](https://guroo.academy/post/from-individual-sales-to-b2b-contracts-marketing-short-courses) (vendor blog).
- Procurement runs dedicated sourcing for training. Real job postings show it:
  - [Caterpillar, *Learning & Development Indirect Buyer*](https://jobs.peoria.org/companies/caterpillar/jobs/84426455-learning-development-indirect-buyer): sourcing L&D services, MSAs, SOWs and SLAs, working with business stakeholders.
  - [Citi, *Procurement Category Manager, Learning & Culture & Recruitment Services*](https://jobs.citi.com/job/budapest/procurement-category-manager-learning-and-culture-and-recruitment-services/287/64405414848) (Budapest, EMEA scope).
  - [Guidant Global, *Category Manager HR Services & Others*](https://jobs.guidantglobal.com/job/category-manager-hr-services-and-others-5792728).
- Polish procurement practice: a request for proposals with formal, substantive and logistical criteria, supplier qualification and a preferred-supplier list. This comes from procurement training programmes listed in the PARP *Baza Usług Rozwojowych*, for example [usługa 2217892](https://uslugirozwojowe.parp.gov.pl/wyszukiwarka/uslugi/drukuj-pdf?id=2217892).

## What the app does with it

1. **Discovery looks for every route to the budget, not only L&D.** The crawler scores management, supplier/procurement, contact, HR and academy pages (`scoreLink` in `extract.ts`). A company's stored contacts are spread across departments first: one HR/L&D contact, one procurement contact, one business leader, and only then a second person from the same department (`spreadAcrossFunctions`). The default cap is 4 contacts per company (setting *Maks. kontaktów na firmę*).
2. **Mailboxes are classified.** `zakupy@`, `procurement@`, `dostawcy@`, `przetargi@` and similar are stored as procurement department inboxes. *Dla dostawców* pages that invite offers are kept as procurement channels.
3. **Paid lookups use matching departments.** Hunter domain search asks for `hr`, `education`, `management`, `executive` and `operations`, and the spend is capped by the configured limit.
4. **False friends are excluded.** Recruiting, payroll, R&D, *Kierownik zmiany* (shift supervisor), retail merchandise buyers, *Customer Engagement* and bank *Dyrektor Oddziału* titles are not treated as training buyers. A generic *Specjalista ds. zakupów* is left as "uncertain" because in industry this role usually buys materials, not services. It counts once the title shows services or indirect spend.
5. **Emails adapt to the department.** HR gets fit with people priorities and practicality. L&D gets programme design. Procurement gets a brief, factual note asking for the right internal owner or the supplier process, with no outcome claims. Business leaders get the team outcome in plain business language. The angle only changes emphasis; facts still come only from approved materials.
6. **The owner can correct it.** The department is a filter (*Dział*) and a column in Kontakty. It can be changed in the contact panel.

## Limits

- Titles vary a lot. Unusual ones stay "Rola niepewna" until the owner sets the department.
- A business leader or procurement contact is a route in, not a guaranteed buyer. The email to them should make it easy to forward the message to the right person.
- Company websites in Poland rarely publish named HR, L&D or procurement people with emails. Most named contacts will come from a paid provider (Hunter) or be added by the owner.
