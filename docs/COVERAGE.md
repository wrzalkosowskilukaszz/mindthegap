# Coverage report

Generated from the database on 2026-10-15 (last discovery run finished 2026-10-15 15:04 UTC) by `scripts/coverage-report.ts`. Aggregate numbers only: names and addresses stay in the database.

Sources used: the companies' own public websites (free crawler) and Wikidata for new companies. **No paid provider was configured**, so no email addresses were looked up or verified by Hunter, and the AI-assisted reading was off.

## Companies

| | Count |
|---|---|
| Companies in the universe (not excluded) | 400 |
| Researched at least once | 388 (97%) |
| Still queued | 12 |
| Excluded | 22 |
| With a relevant contact **and an address** | 21 (5% of researched) |

### Research outcome per company

| Outcome | Companies |
|---|---|
| General address only (info@, kontakt@) | 130 |
| Nothing suitable published | 116 |
| Relevant person found, no published address | 61 |
| Website unavailable or blocked by robots.txt | 60 |
| Relevant contact with an address | 21 |

### By sector

| Sector | Companies | Researched | With relevant contact + address |
|---|---|---|---|
| Produkcja i przemysł | 74 | 67 | 7 |
| Usługi biznesowe / SSC | 67 | 67 | 2 |
| Finanse i ubezpieczenia | 64 | 63 | 1 |
| Handel i dobra konsumpcyjne | 56 | 53 | 3 |
| Technologia | 44 | 44 | 1 |
| Farmacja i ochrona zdrowia | 33 | 33 | 3 |
| Logistyka i transport | 21 | 21 | 3 |
| Telekomunikacja i media | 17 | 17 | 0 |
| Energetyka | 16 | 15 | 1 |
| Doradztwo i usługi profesjonalne | 8 | 8 | 0 |

## Contacts

| Kind | Total | With an address |
|---|---|---|
| General addresses (fallback) | 187 | 187 |
| Named people | 105 | 3 |
| Department mailboxes | 26 | 26 |

### By department (people and department mailboxes)

| Department | People | People with address | Department mailboxes |
|---|---|---|---|
| Kierownictwo biznesu | 56 | 1 | 0 |
| HR / People | 30 | 1 | 11 |
| Szkolenia i rozwój (L&D) | 9 | 0 | 6 |
| Zakupy | 5 | 1 | 9 |
| Transformacja / zmiana | 3 | 0 | 0 |
| Kultura i zaangażowanie | 2 | 0 | 0 |

### Named people by role assessment

| Role | People |
|---|---|
| Likely decision-maker | 84 |
| Organiser / influencer | 19 |
| Uncertain | 2 |

## What this means

- Public company websites in Poland name senior HR, L&D, procurement and business leaders fairly often, but they **rarely publish their email addresses**. Those people are stored with their source page, marked *Brak adresu*, and are the best use of a paid lookup (Hunter's free plan: 50 credits a month; found-only mode).
- Department mailboxes (HR, training, procurement, supplier channels) are the most common usable result from public pages.
- Companies with only a general address keep that one address as a last-resort route, never more than one per company.
- Unresolved companies get a revisit date; the daily run comes back to them and to newly discovered companies.
- Most "website unavailable" results were HTTP 403 answers from bot protection in the research environment (and some robots.txt rules). Those companies are queued again so the production app retries them from its own network.
