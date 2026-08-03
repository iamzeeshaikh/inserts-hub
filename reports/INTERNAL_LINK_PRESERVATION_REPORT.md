# Internal link preservation report

The immutable baseline in `OLD_INTERNAL_LINK_BASELINE.csv` was captured from the
clean exports **before any content was changed** and has not been edited since.
`INTERNAL_LINK_MAP.csv` records what the migration actually did to each link.

## Baseline (old site)

| Disposition | Links |
| --- | ---: |
| Preserved unchanged | 131 |
| Updated (destination changed) | 1 |
| Removed | 5 |
| External, kept | 1 |
| **Total baseline links** | **138** |

## Migration outcome (contextual links in page copy)

| Disposition | Links |
| --- | ---: |
| Preserved unchanged | 94 |
| Updated to a live destination | 2 |
| Removed (unwrapped or deleted) | 1 |
| **Total contextual links processed** | **97** |

## Every link that was not preserved verbatim

| Source | Old destination | Disposition | Replacement | Reason |
| --- | --- | --- | --- | --- |
| /product/custom-paperboard-inserts/ | (second link in paragraph) | removed | — | Removed to honour the one-contextual-link-per-paragraph rule. |
| /product/kraft-cardboard-inserts/ | /product/White-cardboard-inserts/ | updated | /product/white-cardboard-inserts/ | Slug casing corrected to the canonical lowercase URL. |
| /product/white-cardboard-inserts/ | /product/printed-cardboard-inserts/ | updated | /product/custom-cardboard-inserts/ | Destination was an unpublished draft that 404s on the old site; repointed to the closest live product. |

## Rules enforced by the build

- One contextual link per paragraph — extra links are unwrapped and logged.
- No contextual self-links; a page never links to itself in its own copy.
- No generic anchors ("click here", "learn more", "read more", "view product", "explore").
- No links to any 410 spam URL.
- Navigation, footer, breadcrumb, pagination and related-product links are treated
  as structural chrome and reported separately from contextual links.

## Orphan pages

`ORPHAN_PAGE_REPORT.csv` lists incoming-link counts for every built page. The
post-build validator fails if any indexable page has zero incoming links.
Result at the last run: **0 orphan indexable pages**.
