# Company universe — merge report

Generated: 2026-10-15 by `scripts/merge-universe.ts` from `staging/financial.jsonl`, `staging/industrial.jsonl`, `staging/pharma-consumer.jsonl`, `staging/services.jsonl`, `staging/technology.jsonl`.

- Records accepted: **372**
- With Polish headcount (sourced): 213; global headcount only: 124; no sourced headcount: 35
- With at least one priority signal (L&D evidence): 152
- Invalid records rejected by the schema: 0
- Cross-slice duplicates removed: 6

## By sector

| Sector | Companies |
|---|---|
| business_services | 67 |
| financial_services | 64 |
| manufacturing_industrial | 61 |
| retail_consumer | 47 |
| technology | 42 |
| pharma_healthcare | 32 |
| logistics_transport | 20 |
| telecom_media | 17 |
| energy_utilities | 14 |
| professional_services | 8 |

## Duplicates removed

- kept bnp-paribas-bank-polska (financial.jsonl), dropped bnp-paribas-leasing-solutions-polska (financial.jsonl) (same domain/slug)
- kept ikea-retail-polska (pharma-consumer.jsonl), dropped ikea-industry-poland (industrial.jsonl) (same domain/slug)
- kept amica (industrial.jsonl), dropped amica (pharma-consumer.jsonl) (same domain/slug)
- kept philip-morris-polska (pharma-consumer.jsonl), dropped pmi-service-center-europe-krakow (services.jsonl) (same domain/slug)
- kept allegro (technology.jsonl), dropped allegro (pharma-consumer.jsonl) (same domain/slug)
- kept samsung-electronics-poland-manufacturing (industrial.jsonl), dropped samsung-rnd-poland (technology.jsonl) (same domain/slug)

## Invalid records

None.
