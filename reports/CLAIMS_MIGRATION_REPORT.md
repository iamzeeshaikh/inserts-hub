# Claims migration report

Every commercial, material, environmental and service claim present in the clean
WooCommerce export has been carried into the Astro build **verbatim**. No claim
was weakened, qualified or dropped, and no new certification, price, measurement,
regulatory approval or performance guarantee was invented.

Claims stay attached to the products that already made them — none were copied
across the catalogue.

## Claim coverage

| Claim | Products asserting it | Source | Preserved or normalized |
| --- | ---: | --- | --- |
| Free design assistance | 31 | WooCommerce CSV (short description / specifications) | Preserved verbatim |
| Printing options | 30 | WooCommerce CSV (short description / specifications) | Preserved verbatim |
| Fast turnaround times | 29 | WooCommerce CSV (short description / specifications) | Preserved verbatim |
| High-quality material | 29 | WooCommerce CSV (short description / specifications) | Preserved verbatim |
| Gloss / Matte / Spot UV coating options | 28 | WooCommerce CSV (short description / specifications) | Preserved verbatim |
| Custom sizes and styles available | 24 | WooCommerce CSV (short description / specifications) | Preserved verbatim |
| Recycled / recyclable material | 23 | WooCommerce CSV (short description / specifications) | Preserved verbatim |
| Free shipping | 14 | WooCommerce CSV (short description / specifications) | Preserved verbatim |
| Eco-friendly material | 13 | WooCommerce CSV (short description / specifications) | Preserved verbatim |
| Wholesale pricing | 11 | WooCommerce CSV (short description / specifications) | Preserved verbatim |
| Die cutting | 8 | WooCommerce CSV (short description / specifications) | Preserved verbatim |
| Moisture-resistant coating | 2 | WooCommerce CSV (short description / specifications) | Preserved verbatim |
| Anti-static treatment | 2 | WooCommerce CSV (short description / specifications) | Preserved verbatim |

Row-level detail, including the source URL for every individual assertion, is in
`CLAIMS_MIGRATION_DATA.csv` (244 rows).

## Pricing

The WooCommerce export lists a regular price of **$0.3 USD** with
**In stock** availability for all 31 products. Both values are preserved on the
page and in the Offer schema exactly as exported.

`priceValidUntil` is deliberately **omitted**: the old site emitted a rolling
date that has no basis in the source data, and inventing one is out of scope.

## Ratings and reviews

The old Product schema carried `aggregateRating` 5/5 with `reviewCount` 1 and a
single review authored by the site administrator's own email address, whose body
was a verbatim copy of the meta description. That is fabricated review data and
has **not** been carried over. See `MIGRATION_CONFLICTS.md`.

## Source conflict resolution

No conflicts were found between the WooCommerce CSV, the WordPress XML and the
live pages for any claim. Where the live page and a clean export differed, the
clean export won, per the migration policy.
