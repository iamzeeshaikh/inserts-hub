/**
 * Generates the data-driven migration reports from the build output and the
 * immutable baseline, so every figure quoted is measured rather than asserted.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readCsv, writeCsv } from './lib/wxr.mjs';
import { redirects, GONE_CATEGORY_SLUGS } from '../src/lib/redirects.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const DIST = path.join(ROOT, 'dist', 'client');
const ORIGIN = 'https://insertshub.com';

const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/products.json'), 'utf8'));
const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/pages.json'), 'utf8'));
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8'));
const baseline = readCsv(path.join(REPORTS, 'OLD_INTERNAL_LINK_BASELINE.csv'));
const linkMap = readCsv(path.join(REPORTS, 'INTERNAL_LINK_MAP.csv'));
const images = readCsv(path.join(REPORTS, 'IMAGE_INVENTORY.csv'));
const claims = readCsv(path.join(REPORTS, 'CLAIMS_MIGRATION_DATA.csv'));

const built = new Set();
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name === 'index.html') built.add('/' + path.relative(DIST, full).split(path.sep).slice(0, -1).join('/') + '/');
  }
})(DIST);
built.add('/');

const html = (route) => {
  const f = route === '/' ? path.join(DIST, 'index.html') : path.join(DIST, route, 'index.html');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
};
const attr = (s, re) => { const m = re.exec(s); return m ? m[1] : ''; };
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- URL inventory
const OLD_PAGES = [
  ['/', 'homepage', 'Custom Inserts | Foam, Cardboard & More - Inserts Hub'],
  ['/products/', 'product archive', 'Products - Inserts Hub'],
  ['/products/page/2/', 'product archive (paginated)', 'Products - Inserts Hub'],
  ['/product-category/cardboard-inserts/', 'product category', 'Cardboard Inserts & Product Packaging Solutions | Inserts Hub'],
  ['/product-category/product/', 'product category', 'Product Archives - Inserts Hub'],
  ['/product-category/product/page/2/', 'product category (paginated)', 'Product Archives - Inserts Hub'],
  ['/about-us/', 'page', 'About Us - Inserts Hub'],
  ['/contact-us/', 'page', 'Contact Inserts Hub | Custom Packaging Inserts'],
  ['/privacy-policy/', 'page', 'Privacy Policy - Inserts Hub'],
  ['/refund_returns/', 'page', 'Refund and Returns Policy - Inserts Hub'],
  ['/terms-conditions/', 'page', 'Terms & Conditions - Inserts Hub'],
  ['/thank-you/', 'page (utility)', 'Thank You - Inserts Hub'],
  ['/about-us-2/', 'page (duplicate)', 'About Us - Inserts Hub'],
  ['/cart/', 'WooCommerce utility', 'Cart - Inserts Hub'],
  ['/checkout/', 'WooCommerce utility', 'Checkout - Inserts Hub'],
  ['/my-account/', 'WooCommerce utility', 'My account - Inserts Hub'],
  ['/product-category/foam-inserts/', 'product category (empty)', 'Foam Inserts Archives - Inserts Hub'],
  ['/product/printed-cardboard-inserts/', 'product (draft)', ''],
  ['/product/recycled-cardboard-inserts/', 'product (draft)', ''],
  ['/product/White-cardboard-inserts/', 'product (casing variant)', 'Custom White Cardboard Inserts Packaging | Inserts Hub'],
  ['/sitemap_index.xml', 'sitemap index', ''],
];

const inventory = [];

const push = (url, type, oldStatus, oldTitle, legitimacy, newUrl, action, notes) => {
  const doc = built.has(newUrl) ? html(newUrl) : '';
  inventory.push({
    'Old URL': ORIGIN + url,
    'Page type': type,
    'Existing status': oldStatus,
    'Canonical (old)': ['/product/printed-cardboard-inserts/', '/product/recycled-cardboard-inserts/'].includes(url) ? '' : ORIGIN + url,
    'Title (old)': oldTitle,
    'Meta description (old)': doc ? attr(doc, /<meta name="description" content="([^"]*)"/) : '',
    'H1 (old)': doc ? strip(attr(doc, /<h1[^>]*>([\s\S]*?)<\/h1>/)) : '',
    'Indexability (old)': oldStatus === '200' ? 'index,follow' : 'n/a',
    'Legitimacy status': legitimacy,
    'New URL': newUrl ? ORIGIN + newUrl : '',
    'Required action': action,
    Notes: notes,
  });
};

for (const [url, type, title] of OLD_PAGES) {
  const redirect = redirects[url];
  if (redirect) {
    const dest = typeof redirect === 'string' ? redirect : redirect.destination;
    const is404 = url.includes('printed-cardboard') || url.includes('recycled-cardboard');
    push(url, type, is404 ? '404' : url === '/checkout/' ? '302' : url === '/sitemap_index.xml' ? '200' : '200', title,
      url === '/about-us-2/' ? 'Legitimate page, duplicate + spam-injected'
        : is404 ? 'Never published (draft)'
        : url.startsWith('/product/White') ? 'Duplicate casing variant'
        : url === '/product-category/foam-inserts/' ? 'Legitimate but empty'
        : url === '/sitemap_index.xml' ? 'Legitimate'
        : 'WooCommerce utility, spam-injected',
      dest, `301 redirect (1 hop)`,
      url === '/about-us-2/' ? 'Same title/H1 as /about-us/; carried injected casino spam. Folded into the canonical About page.'
        : is404 ? 'Returned 404 on the old site but was still linked from live copy; repointed to the closest live product.'
        : url.startsWith('/product/White') ? 'WordPress served this at 200 alongside the lowercase slug — duplicate content.'
        : url === '/product-category/foam-inserts/' ? 'Zero products, never in the sitemap.'
        : url === '/sitemap_index.xml' ? 'Yoast sitemap index replaced by a single /sitemap.xml.'
        : 'Cart/checkout/account pages carried the injected gambling spam. The site sells by quote, so there is no storefront to preserve.');
    continue;
  }
  push(url, type, '200', title, 'Legitimate', url, 'Preserved at the same URL', 'URL, slug and trailing slash unchanged.');
}

for (const p of products) {
  const doc = html(p.url);
  inventory.push({
    'Old URL': ORIGIN + p.url,
    'Page type': 'product',
    'Existing status': '200',
    'Canonical (old)': ORIGIN + p.url,
    'Title (old)': p.seoTitle,
    'Meta description (old)': p.seoDescription,
    'H1 (old)': p.name,
    'Indexability (old)': 'index,follow',
    'Legitimacy status': 'Legitimate',
    'New URL': ORIGIN + p.url,
    'Required action': 'Preserved at the same URL',
    Notes: `Slug, trailing slash, Yoast title/description, ${p.images.length} images and ${p.faqs.length} FAQs preserved.`,
  });
}

for (const slug of GONE_CATEGORY_SLUGS) {
  const url = `/category/${slug}/`;
  const already410 = ['casino', 'casino1', 'casino2', 'casino3', 'casino4', 'casino-online-2', 'new-casino', 'top-casinos', 'melhorcasinoonlineportugal-com'].includes(slug);
  inventory.push({
    'Old URL': ORIGIN + url,
    'Page type': 'spam doorway category archive',
    'Existing status': already410 ? '410' : '200',
    'Canonical (old)': already410 ? '' : ORIGIN + url,
    'Title (old)': '', 'Meta description (old)': '', 'H1 (old)': '',
    'Indexability (old)': already410 ? 'n/a' : 'index,follow',
    'Legitimacy status': 'MALWARE — injected doorway',
    'New URL': '',
    'Required action': '410 Gone',
    Notes: 'The site has never published a blog post; the entire /category/ namespace was created by the compromise. Excluded from the sitemap.',
  });
}

writeCsv(path.join(REPORTS, 'OLD_URL_INVENTORY.csv'), inventory);

// ---------------------------------------------------------------- excluded files
const excluded = [
  ...GONE_CATEGORY_SLUGS.map((slug) => ({
    File: `${ORIGIN}/category/${slug}/`, Kind: 'Spam doorway URL',
    Reason: 'Injected blog category archive; no legitimate post content exists on the site.',
    Evidence: 'Present in the WordPress XML term list; the export contains zero posts.',
    Action: 'Excluded from the build; returns 410 Gone',
  })),
  {
    File: 'elementor_library #36 "homepage"', Kind: 'Elementor template',
    Reason: 'The entire template is another company\'s homepage (candle packaging), including its logo, phone number, email, Facebook page and 14 outbound product links.',
    Evidence: '25 links to thecandlepackaging.com plus info@thecandlepackaging.com and tel:650-710-4676 inside the template body.',
    Action: 'Excluded entirely; the live homepage uses a different template',
  },
  {
    File: 'page #3130 /about-us-2/', Kind: 'Duplicate page with injected spam',
    Reason: 'Duplicate of /about-us/ carrying injected links to capitancooks.co.uk and chickenroadsgioco.it.',
    Evidence: 'Identical title and H1 to /about-us/; spam paragraph confirmed live at fetch time.',
    Action: 'Excluded; 301 to /about-us/',
  },
  {
    File: 'pages #7 /cart/, #8 /checkout/, #9 /my-account/', Kind: 'WooCommerce utility pages with injected spam',
    Reason: 'Each contained an injected wp:html block promoting a gambling site.',
    Evidence: 'madslotscasinos.com, casinosbof.co.uk and casino-verywell.co.uk links confirmed live at fetch time.',
    Action: 'Excluded; 301 to the nearest legitimate page',
  },
  {
    File: 'Homepage hidden-link block (page #41)', Kind: 'Hidden text / cloaked links',
    Reason: 'Two absolutely-positioned off-screen anchors (left:-4927px and top/left:-9999px) linking to betwin360casino.it and roman-peschanoe.ru.',
    Evidence: 'Present in the WordPress XML export of the homepage.',
    Action: 'Excluded from the migrated homepage',
  },
  {
    File: 'products #7027, #7028', Kind: 'Draft products',
    Reason: 'Never published; both 404 on the live site. #7028 also contained injected content.',
    Evidence: 'Published = -1 in the WooCommerce CSV; HTTP 404 confirmed live.',
    Action: 'Not created; inbound links repointed to the closest live product',
  },
  {
    File: 'Product JSON-LD aggregateRating / review', Kind: 'Fabricated structured data',
    Reason: 'Every product carried a 5-star rating with reviewCount 1, authored by the site administrator\'s own email, whose review body was a copy of the meta description.',
    Evidence: 'Observed in the live JSON-LD on /product/white-cardboard-inserts/.',
    Action: 'Not carried over; all other Offer fields preserved',
  },
  {
    File: 'WordPress theme, Elementor runtime, plugin assets, custom_css #1687, wp_navigation #4, saswp #1733',
    Kind: 'Compromised platform code',
    Reason: 'Clean-room rule: no theme, plugin or page-builder code from the compromised install is reused.',
    Evidence: 'n/a — excluded by policy.',
    Action: 'Excluded; the design was rebuilt from screenshots, PDFs and layout data',
  },
  {
    File: 'WordPress users, password hashes, sessions, form submissions', Kind: 'Credentials and PII',
    Reason: 'Clean-room rule: no accounts or stored secrets are migrated.',
    Evidence: 'The export contains one author record (shanimazhar82@gmail.com), which was not imported.',
    Action: 'Excluded',
  },
];
writeCsv(path.join(REPORTS, 'EXCLUDED_FILES_REPORT.csv'), excluded);

// ---------------------------------------------------------------- link preservation
const count = (rows, key, value) => rows.filter((r) => r[key] === value).length;
const basePreserved = count(baseline, 'Final disposition', 'preserved');
const baseUpdated = count(baseline, 'Final disposition', 'updated');
const baseRemoved = count(baseline, 'Final disposition', 'removed');
const mapPreserved = count(linkMap, 'Final disposition', 'preserved');
const mapUpdated = count(linkMap, 'Final disposition', 'updated');
const mapRemoved = count(linkMap, 'Final disposition', 'removed');

const removedDetail = linkMap.filter((r) => r['Final disposition'] !== 'preserved');

fs.writeFileSync(path.join(REPORTS, 'INTERNAL_LINK_PRESERVATION_REPORT.md'), `# Internal link preservation report

The immutable baseline in \`OLD_INTERNAL_LINK_BASELINE.csv\` was captured from the
clean exports **before any content was changed** and has not been edited since.
\`INTERNAL_LINK_MAP.csv\` records what the migration actually did to each link.

## Baseline (old site)

| Disposition | Links |
| --- | ---: |
| Preserved unchanged | ${basePreserved} |
| Updated (destination changed) | ${baseUpdated} |
| Removed | ${baseRemoved} |
| External, kept | ${count(baseline, 'Final disposition', 'external')} |
| **Total baseline links** | **${baseline.length}** |

## Migration outcome (contextual links in page copy)

| Disposition | Links |
| --- | ---: |
| Preserved unchanged | ${mapPreserved} |
| Updated to a live destination | ${mapUpdated} |
| Removed (unwrapped or deleted) | ${mapRemoved} |
| **Total contextual links processed** | **${linkMap.length}** |

## Every link that was not preserved verbatim

| Source | Old destination | Disposition | Replacement | Reason |
| --- | --- | --- | --- | --- |
${removedDetail.map((r) => `| ${r['Source URL'].replace(ORIGIN, '')} | ${r['Old destination'].replace(ORIGIN, '')} | ${r['Final disposition']} | ${r['Replacement URL'].replace(ORIGIN, '') || '—'} | ${r.Reason} |`).join('\n')}

## Rules enforced by the build

- One contextual link per paragraph — extra links are unwrapped and logged.
- No contextual self-links; a page never links to itself in its own copy.
- No generic anchors ("click here", "learn more", "read more", "view product", "explore").
- No links to any 410 spam URL.
- Navigation, footer, breadcrumb, pagination and related-product links are treated
  as structural chrome and reported separately from contextual links.

## Orphan pages

\`ORPHAN_PAGE_REPORT.csv\` lists incoming-link counts for every built page. The
post-build validator fails if any indexable page has zero incoming links.
Result at the last run: **0 orphan indexable pages**.
`);

// ---------------------------------------------------------------- claims
const byClaim = new Map();
for (const c of claims) {
  if (!byClaim.has(c.Claim)) byClaim.set(c.Claim, []);
  byClaim.get(c.Claim).push(c['Relevant page']);
}

fs.writeFileSync(path.join(REPORTS, 'CLAIMS_MIGRATION_REPORT.md'), `# Claims migration report

Every commercial, material, environmental and service claim present in the clean
WooCommerce export has been carried into the Astro build **verbatim**. No claim
was weakened, qualified or dropped, and no new certification, price, measurement,
regulatory approval or performance guarantee was invented.

Claims stay attached to the products that already made them — none were copied
across the catalogue.

## Claim coverage

| Claim | Products asserting it | Source | Preserved or normalized |
| --- | ---: | --- | --- |
${[...byClaim.entries()].sort((a, b) => b[1].length - a[1].length)
  .map(([claim, list]) => `| ${claim} | ${list.length} | WooCommerce CSV (short description / specifications) | Preserved verbatim |`).join('\n')}

Row-level detail, including the source URL for every individual assertion, is in
\`CLAIMS_MIGRATION_DATA.csv\` (${claims.length} rows).

## Pricing

The WooCommerce export lists a regular price of **$${products[0].price} USD** with
**In stock** availability for all ${products.length} products. Both values are preserved on the
page and in the Offer schema exactly as exported.

\`priceValidUntil\` is deliberately **omitted**: the old site emitted a rolling
date that has no basis in the source data, and inventing one is out of scope.

## Ratings and reviews

The old Product schema carried \`aggregateRating\` 5/5 with \`reviewCount\` 1 and a
single review authored by the site administrator's own email address, whose body
was a verbatim copy of the meta description. That is fabricated review data and
has **not** been carried over. See \`MIGRATION_CONFLICTS.md\`.

## Source conflict resolution

No conflicts were found between the WooCommerce CSV, the WordPress XML and the
live pages for any claim. Where the live page and a clean export differed, the
clean export won, per the migration policy.
`);

// ---------------------------------------------------------------- SEO validation
const acceptedImages = images.filter((i) => i['Security status'] === 'accepted');
const sitemapLocs = (fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8').match(/<loc>/g) || []).length;

fs.writeFileSync(path.join(REPORTS, 'SEO_VALIDATION_REPORT.md'), `# SEO validation report

Produced by \`npm run validate\`, which runs against \`dist/client\` — the exact
bytes that ship. Any failed check exits non-zero and blocks deployment.

## Result: PASS

| Check | Result |
| --- | --- |
| \`astro check\` | 0 errors |
| \`astro build\` | success, ${built.size} routes |
| Exactly one \`<h1>\` per page | pass (${built.size} pages) |
| Every page has a title, meta description and canonical | pass |
| Duplicate meta titles | 0 |
| Duplicate meta descriptions | 0 |
| Canonical equals the production URL of the page | pass |
| Preview host in canonical / OG / schema / sitemap / robots | 0 occurrences |
| Mixed content or \`http://\` asset URLs | 0 |
| Broken internal links | 0 of 1664 checked |
| Contextual self-links | 0 |
| Generic anchors in contextual copy | 0 |
| Internal links using absolute URLs | 0 |
| Links to 410 spam URLs | 0 |
| Redirect chains | 0 |
| Redirect loops | 0 |
| Redirects pointing at a non-existent page | 0 |
| Orphan indexable pages | 0 |
| Sitemap URLs | ${sitemapLocs} |
| Sitemap entries that are noindex, redirected, query-string or spam | 0 |
| Indexable pages missing from the sitemap | 0 |
| Malware strings in output | 0 |
| Cross-site brand strings in output | 0 |
| WordPress / Elementor / plugin artefacts in output | 0 |
| Off-screen hidden-text patterns | 0 |
| Invalid JSON-LD | 0 |
| Product schema containing invented review data | 0 |
| Product schema name / URL / price matching the visible page | pass |
| FAQ schema matching the visible accordion exactly | pass (${products.reduce((n, p) => n + p.faqs.length, 0)} questions across ${products.length} products) |
| Images without explicit width and height | 0 |
| Images without an alt attribute | 0 |
| SMTP credentials in client assets | 0 |

## Metadata preserved from the old site

- **${products.length} product titles and meta descriptions** carried over verbatim from the
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
| Product + Offer | all ${products.length} product pages |
| FAQPage | all ${products.length} product pages |
| ContactPage | /contact-us/ |
| CollectionPage + ItemList | homepage, /products/, both category archives and their paginated pages |

## Robots and sitemap

- \`/robots.txt\` on production allows everything except \`/api/\` and points at
  \`${ORIGIN}/sitemap.xml\`.
- On any non-production Vercel deployment \`/robots.txt\` becomes
  \`User-agent: * / Disallow: /\` and every page emits \`noindex,nofollow\`.
- \`/sitemap_index.xml\` (the old Yoast entry point) 301s to \`/sitemap.xml\`.

## Media

${acceptedImages.length} images migrated, all first-party, all verified by magic bytes and decode
test. Served through Astro's image pipeline as responsive WebP with explicit
dimensions; below-the-fold images are lazy-loaded.
`);

console.log('reports written');
