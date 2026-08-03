# SEO validation report

Produced by `npm run validate`, which runs against `dist/client` — the exact
bytes that ship. Any failed check exits non-zero and blocks deployment.

## Result: PASS

| Check | Result |
| --- | --- |
| `astro check` | 0 errors |
| `astro build` | success, 44 routes |
| Exactly one `<h1>` per page | pass (44 pages) |
| Every page has a title, meta description and canonical | pass |
| Duplicate meta titles | 0 |
| Duplicate meta descriptions | 0 |
| Canonical equals the production URL of the page | pass |
| Preview host in canonical / OG / schema / sitemap / robots | 0 occurrences |
| Mixed content or `http://` asset URLs | 0 |
| Broken internal links | 0 of 1664 checked |
| Contextual self-links | 0 |
| Generic anchors in contextual copy | 0 |
| Internal links using absolute URLs | 0 |
| Links to 410 spam URLs | 0 |
| Redirect chains | 0 |
| Redirect loops | 0 |
| Redirects pointing at a non-existent page | 0 |
| Orphan indexable pages | 0 |
| Sitemap URLs | 42 |
| Sitemap entries that are noindex, redirected, query-string or spam | 0 |
| Indexable pages missing from the sitemap | 0 |
| Malware strings in output | 0 |
| Cross-site brand strings in output | 0 |
| WordPress / Elementor / plugin artefacts in output | 0 |
| Off-screen hidden-text patterns | 0 |
| Invalid JSON-LD | 0 |
| Product schema containing invented review data | 0 |
| Product schema name / URL / price matching the visible page | pass |
| FAQ schema matching the visible accordion exactly | pass (440 questions across 31 products) |
| Images without explicit width and height | 0 |
| Images without an alt attribute | 0 |
| SMTP credentials in client assets | 0 |

## Metadata preserved from the old site

- **31 product titles and meta descriptions** carried over verbatim from the
  Yoast fields in the WooCommerce export.
- **Homepage, contact page and Cardboard Inserts category** keep their existing
  Yoast title and description exactly.
- Pages that had **no** meta description on the old site (products archive, about,
  privacy, terms, refund, thank-you, the Product category) were given unique,
  page-specific descriptions, since a missing description is a defect rather than
  a ranking asset to preserve.

## Structured data

| Type | Where |
| --- | --- |
| Organization | homepage and contact page |
| WebSite | homepage |
| BreadcrumbList | every product, archive, category and content page |
| Product + Offer | all 31 product pages |
| FAQPage | all 31 product pages |
| ContactPage | /contact-us/ |
| CollectionPage + ItemList | homepage, /products/, both category archives and their paginated pages |

## Robots and sitemap

- `/robots.txt` on production allows everything except `/api/` and points at
  `https://insertshub.com/sitemap.xml`.
- On any non-production Vercel deployment `/robots.txt` becomes
  `User-agent: * / Disallow: /` and every page emits `noindex,nofollow`.
- `/sitemap_index.xml` (the old Yoast entry point) 301s to `/sitemap.xml`.

## Media

134 images migrated, all first-party, all verified by magic bytes and decode
test. Served through Astro's image pipeline as responsive WebP with explicit
dimensions; below-the-fold images are lazy-loaded.
