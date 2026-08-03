# Migration report — insertshub.com → Astro

**Date:** 3 August 2026
**Preview:** https://inserts-hub.vercel.app (noindex)
**Production origin (unchanged):** https://insertshub.com
**DNS:** not touched.

A clean-room, like-for-like migration off a malware-affected WordPress /
WooCommerce / Elementor install. The design, content, URLs, slugs, trailing
slashes, metadata and commercial claims are preserved; only the compromised
platform is gone.

---

## Headline numbers

| | |
| --- | ---: |
| Pages built | **44** |
| Products migrated | **31** of 31 published |
| Content pages migrated | **6** |
| Archive / category pages | **6** (incl. pagination) |
| Legitimate URLs preserved at the identical path | **42** |
| 301 redirects (all single-hop) | **9** |
| Malware URLs returning 410 | **33** |
| Unknown URLs returning 404 | all others, incl. `/category/*` outside the verified list |
| Images migrated | **134** |
| Images excluded | **0** |
| FAQ entries migrated | **440** |
| URL inventory rows | 85 |
| Cross-site references corrected | 8 findings |

---

## URLs

Every legitimate URL is preserved **byte-for-byte**, including trailing slashes
and the underscore in `/refund_returns/`. No product moved to a root-level URL
and no slug was renamed.

- `/`
- `/products/`, `/products/page/2/`
- `/product/<slug>/` × 31
- `/product-category/cardboard-inserts/`
- `/product-category/product/`, `/product-category/product/page/2/`
- `/about-us/`, `/contact-us/`, `/privacy-policy/`, `/refund_returns/`,
  `/terms-conditions/`, `/thank-you/`

Nine URLs could not be preserved and each gets one direct 301 to the closest
equivalent — no chains, no loops, no mass homepage redirect, no soft 404, and no
spam URL redirected into the legitimate site. Full list in `REDIRECT_MAP.csv`
and `OLD_URL_INVENTORY.csv`.

---

## Malware removed

| Finding | Action |
| --- | --- |
| 33 injected spam doorway category archives (25 still live at 200) | **410 Gone**, absent from the sitemap |
| Hidden off-screen links to `betwin360casino.it` and `roman-peschanoe.ru` on the homepage | Removed |
| Injected casino paragraphs on `/cart/`, `/checkout/`, `/my-account/`, `/about-us-2/` | Pages retired, 301'd |
| Elementor template #36 — a complete **The Candle Packaging** homepage with that company's email, phone, Facebook page and 25 outbound links | Excluded in full |
| Fabricated 5-star `aggregateRating` + admin-authored review in Product schema | Not carried over |

The word "slot" appears 188 times in the catalogue and **every instance is
legitimate packaging terminology** (slotted dividers, die-cut slots). No product
copy was removed on a keyword match. Detail in `MALWARE_AUDIT_REPORT.md`.

---

## Cross-site contamination

The brief flagged "The Die Cut Stickers" wording on the contact page. On
re-fetch, **the contact page is clean** — no reference to that brand, Kraft Box
Pack, burger packaging, pharmaceutical or gambling brands survives in the live
page or the exports. The contact page was migrated intact: design, form, URL and
Inserts Hub's own contact details unchanged.

The real contamination was elsewhere — Elementor template #36. It was excluded
whole; no page lost legitimate content because of it. `/product/candle-boxes-with-inserts/`
keeps its candle-packaging wording, which is genuine Inserts Hub product copy.
See `CONTENT_CONTAMINATION_REPORT.csv`.

---

## Internal links

`OLD_INTERNAL_LINK_BASELINE.csv` was captured from the clean exports **before any
content changed** and has not been edited since.

| | Baseline | After migration |
| --- | ---: | ---: |
| Links captured | 138 | 97 contextual links processed |
| Preserved unchanged | 131 | 94 |
| Updated to a live destination | 1 | 2 |
| Removed | 5 | 1 |

The removals are: two injected gambling links on the homepage, two on
`/about-us-2/`, and a `javascript:;` placeholder. The updates fix a broken
capitalised slug and a link to a draft product that 404s on the live site today.

Rules enforced automatically: one contextual link per paragraph, no contextual
self-links, no generic anchors, no links to 410 URLs. Navigation, footer,
breadcrumb, pagination and related-product links are reported separately as
structural chrome. **0 broken links across 1,664 checked. 0 orphan indexable
pages.** See `INTERNAL_LINK_PRESERVATION_REPORT.md`.

---

## Claims

All commercial, material, environmental and service claims are preserved
verbatim — wholesale pricing, free design, free shipping, fast turnaround, custom
sizes and styles, Gloss/Matte/Spot UV coatings, die cutting, recycled and
eco-friendly material, food-grade board, moisture resistance and the rest. 244
individual assertions tracked across the catalogue, each kept on the product that
already made it. Nothing was weakened, and no certification, measurement,
approval or guarantee was invented. See `CLAIMS_MIGRATION_REPORT.md`.

Price (`$0.30 USD`) and availability (`InStock`) are preserved on-page and in the
Offer schema exactly as exported.

---

## Build and validation

| | |
| --- | --- |
| `astro check` | **0 errors** |
| `astro build` | **success**, 44 routes |
| `npm run validate` | **all checks passed** |
| Responsive QA | **55/55 clean** (11 pages × 5 breakpoints) |
| Lighthouse (live mode) | **100 / 100 / 100 / 100** on every page type |

The validator runs against `dist/client` and blocks deployment on: duplicate
titles or descriptions, a page without exactly one `<h1>`, broken or self
linking, redirect chains or loops, preview hosts in canonical/schema/sitemap,
malware or WordPress strings in the output, invalid JSON-LD, Product schema not
matching the visible page, FAQ schema not matching the visible accordion,
images without dimensions or alt text, orphan pages, and SMTP credentials in
client assets.

---

## Security posture of the new site

No database, no admin login, no plugin surface, no theme editor, no upload
directory. One server endpoint (the quote form), which validates every field,
checks upload magic bytes, rejects double extensions and executables, rate-limits
by IP, blocks cross-origin posts, strips CRLF to prevent header injection, and
never writes an upload to disk. SMTP credentials live only in environment
variables and are asserted absent from client bundles.

134 images were each verified by magic bytes, a decode test and a payload scan
before being admitted. None was rejected.

---

## ⚠️ Open items

1. **Email delivery is untested.** SMTP variables are not set; the endpoint
   returns 503 rather than claiming a delivery it did not make. Set the variables
   and send one real enquiry before cutover.
2. **The WooCommerce cart flow is gone.** `/cart/`, `/checkout/` and
   `/my-account/` now redirect. Inserts Hub converts through the quote form, so
   this matches how the site actually sells — but if you do want card payments,
   that needs rebuilding on a payment provider. This is the one decision that
   changes functionality; see `MIGRATION_CONFLICTS.md` §5.
3. **The old server is still compromised.** Migrating the site does not clean it.
   Work through `SECURITY_CUTOVER_CHECKLIST.md`.
4. **DNS has not been changed** and will not be without your explicit go-ahead.
   Records and rollback steps are in `DEPLOYMENT_REPORT.md`.

---

## Report index

| File | Contents |
| --- | --- |
| `MIGRATION_REPORT.md` | This document |
| `MALWARE_AUDIT_REPORT.md` | Full security audit of exports and live site |
| `SECURITY_CUTOVER_CHECKLIST.md` | Containment and credential rotation |
| `MIGRATION_CONFLICTS.md` | 13 conflicts and judgement calls, with reasoning |
| `CONTENT_CONTAMINATION_REPORT.csv` | Cross-site brand findings and fixes |
| `OLD_URL_INVENTORY.csv` | 85 old URLs: status, metadata, legitimacy, action |
| `REDIRECT_MAP.csv` | 9 redirects |
| `SPAM_URL_MAP.csv` | 33 spam URLs and their new status |
| `EXCLUDED_FILES_REPORT.csv` | 41 excluded items with evidence |
| `IMAGE_INVENTORY.csv` | 134 images: MIME, dimensions, hash, security status |
| `CONTENT_INVENTORY.csv` | Every page: title, H1, description, body size |
| `CLAIMS_MIGRATION_REPORT.md` + `CLAIMS_MIGRATION_DATA.csv` | 244 claim assertions |
| `OLD_INTERNAL_LINK_BASELINE.csv` | **Immutable** pre-change link baseline |
| `INTERNAL_LINK_MAP.csv` | What happened to each contextual link |
| `INTERNAL_LINK_PRESERVATION_REPORT.md` | Link preservation analysis |
| `ORPHAN_PAGE_REPORT.csv` | Incoming-link counts per page |
| `SEO_VALIDATION_REPORT.md` | Every automated SEO check and its result |
| `RESPONSIVE_QA_REPORT.md` | 55 breakpoint combinations |
| `DEPLOYMENT_REPORT.md` | Deployment, DNS cutover and rollback |
| `ENVIRONMENT_VARIABLES.md` | SMTP config and the `SITE_LIVE` indexing switch |
