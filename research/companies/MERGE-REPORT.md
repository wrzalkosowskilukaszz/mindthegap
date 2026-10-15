# Company universe — merge report

Generated: 2026-10-15 by `scripts/merge-universe.ts` from `staging/expansion-awards.jsonl`, `staging/expansion-tech-media.jsonl`, `staging/financial.jsonl`, `staging/industrial.jsonl`, `staging/pharma-consumer.jsonl`, `staging/services.jsonl`, `staging/technology.jsonl`.

- Records accepted: **543**
- With Polish headcount (sourced): 266; global headcount only: 161; no sourced headcount: 116
- With at least one priority signal (L&D evidence): 274
- Invalid records rejected by the schema: 0
- Cross-slice duplicates removed: 9

## By sector

| Sector | Companies |
|---|---|
| manufacturing_industrial | 111 |
| business_services | 77 |
| retail_consumer | 75 |
| financial_services | 69 |
| technology | 54 |
| pharma_healthcare | 48 |
| professional_services | 35 |
| logistics_transport | 31 |
| telecom_media | 18 |
| energy_utilities | 15 |
| other | 10 |

## Duplicates removed

- kept dhl-parcel-polska (expansion-awards.jsonl), dropped dhl-global-forwarding-polska (expansion-awards.jsonl) (same domain/slug)
- kept dhl-parcel-polska (expansion-awards.jsonl), dropped dhl-express-polska (expansion-awards.jsonl) (same domain/slug)
- kept publicis-groupe-poland (expansion-tech-media.jsonl), dropped publicis-groupe-poland (expansion-awards.jsonl) (same domain/slug)
- kept bnp-paribas-bank-polska (financial.jsonl), dropped bnp-paribas-leasing-solutions-polska (financial.jsonl) (same domain/slug)
- kept ikea-retail-polska (pharma-consumer.jsonl), dropped ikea-industry-poland (industrial.jsonl) (same domain/slug)
- kept amica (industrial.jsonl), dropped amica (pharma-consumer.jsonl) (same domain/slug)
- kept philip-morris-polska (pharma-consumer.jsonl), dropped pmi-service-center-europe-krakow (services.jsonl) (same domain/slug)
- kept allegro (technology.jsonl), dropped allegro (pharma-consumer.jsonl) (same domain/slug)
- kept samsung-electronics-poland-manufacturing (industrial.jsonl), dropped samsung-rnd-poland (technology.jsonl) (same domain/slug)

## Invalid records

None.
