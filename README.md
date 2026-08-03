# Inserts Hub — Astro

Clean-room rebuild of https://insertshub.com, replacing a malware-affected
WordPress / WooCommerce / Elementor installation.

No WordPress theme, plugin, Elementor runtime or database content was carried
over. The exports are parsed as inert data and every field is re-emitted through
a strict tag/attribute allowlist.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run check` | `astro check` (TypeScript + template diagnostics) |
| `npm run validate` | Post-build validation against `dist/client` |
| `npm run verify` | check + build + validate |
| `node scripts/build-content.mjs` | Re-extract content from the exports in `../` |
| `node scripts/fetch-media.mjs` | Re-download and re-verify every image |
| `node scripts/build-reports.mjs` | Regenerate the data-driven migration reports |
| `node scripts/serve.mjs 4399` | Serve `dist/client` with production routing (redirects, 404, 410) |
| `node scripts/responsive-qa.mjs http://localhost:4399` | Browser QA at 320–1440px |

## Layout

```
src/data/        migrated, sanitised content (products, pages, site config)
src/lib/         typed data access, schema builders, redirect map, env
src/components/  SiteHeader, SiteFooter, SEOHead, ProductCard, ProductGallery, …
src/pages/       routes — URLs and trailing slashes match the old site exactly
scripts/         migration, media, validation and QA tooling
reports/         migration, security, SEO, link and QA reports
```

## Environment

See `reports/ENVIRONMENT_VARIABLES.md`.
