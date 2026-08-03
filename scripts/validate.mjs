/**
 * Post-build validation. Runs against dist/client — the bytes that actually ship.
 *
 * Any failure exits non-zero so a broken migration can never be deployed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { writeCsv } from './lib/wxr.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist', 'client');
const REPORTS = path.join(ROOT, 'reports');
const ORIGIN = 'https://insertshub.com';

const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/products.json'), 'utf8'));
const pagesData = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/pages.json'), 'utf8'));
const { redirects, GONE_CATEGORY_SLUGS } = await import('../src/lib/redirects.mjs');

const failures = [];
const warnings = [];
const fail = (msg) => failures.push(msg);
const warn = (msg) => warnings.push(msg);

// ---------------------------------------------------------------- load output
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));

const routeOf = (file) => {
  const rel = '/' + path.relative(DIST, file).split(path.sep).join('/');
  if (rel === '/404.html') return '/404/';
  return rel.replace(/index\.html$/, '');
};

const docs = htmlFiles.map((file) => ({ route: routeOf(file), file, html: fs.readFileSync(file, 'utf8') }));
const routes = new Set(docs.map((d) => d.route));
console.log(`validating ${docs.length} built pages`);

const attr = (html, re) => { const m = re.exec(html); return m ? m[1] : ''; };
const all = (html, re) => [...html.matchAll(re)].map((m) => m[1]);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#8217': '\u2019' };
const decode = (s) => s.replace(/&(#?[a-z0-9]+);/gi, (m, e) => (
  ENTITIES[e] ?? (e[0] === '#' ? String.fromCodePoint(Number(e.slice(1))) : m)));
const text = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- 1. structure
const titles = new Map();
const descriptions = new Map();

for (const doc of docs) {
  const { route, html } = doc;
  const h1s = all(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi);
  if (h1s.length !== 1) fail(`${route}: expected exactly 1 <h1>, found ${h1s.length}`);

  const title = attr(html, /<title>([\s\S]*?)<\/title>/i);
  const desc = attr(html, /<meta name="description" content="([^"]*)"/i);
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/i);
  const robots = attr(html, /<meta name="robots" content="([^"]*)"/i);

  if (!title) fail(`${route}: missing <title>`);
  if (!desc) fail(`${route}: missing meta description`);
  if (!canonical) fail(`${route}: missing canonical`);

  const noindex = robots.includes('noindex');
  if (!noindex) {
    if (titles.has(title)) fail(`duplicate <title> on ${route} and ${titles.get(title)}`);
    titles.set(title, route);
    if (descriptions.has(desc)) fail(`duplicate meta description on ${route} and ${descriptions.get(desc)}`);
    descriptions.set(desc, route);
    if (canonical !== `${ORIGIN}${route}`) fail(`${route}: canonical is ${canonical}, expected ${ORIGIN}${route}`);
  }

  // 2. Nothing from a preview host may appear anywhere in indexable metadata.
  for (const bad of html.matchAll(/https?:\/\/[a-z0-9-]*\.?vercel\.(app|sh)[^"'\s<]*/gi)) {
    fail(`${route}: preview host leaked into output → ${bad[0]}`);
  }
  if (/http:\/\/(?!localhost)/.test(html.replace(/http:\/\/www\.w3\.org/g, '').replace(/http:\/\/schema\.org/g, ''))) {
    const hit = /http:\/\/(?!localhost|www\.w3\.org|schema\.org)[^"'\s<]+/.exec(html);
    if (hit) fail(`${route}: mixed content / insecure URL → ${hit[0]}`);
  }
}

// ---------------------------------------------------------------- 3. malware
const MALWARE_STRINGS = [
  'betwin360', 'roman-peschanoe', 'madslotscasino', 'casinosbof', 'casino-verywell',
  'capitancooks', 'chickenroadsgioco', 'melhorcasinoonlineportugal', 'thecandlepackaging',
  'казино', 'captain cooks', 'chicken road',
];
const WP_STRINGS = ['<?php', 'base64_decode', 'gzinflate', 'str_rot13', 'shell_exec', 'passthru(', 'wp-content', 'wp-includes', 'elementor-widget', 'woocommerce-page'];

for (const doc of docs) {
  const lower = doc.html.toLowerCase();
  for (const s of MALWARE_STRINGS) if (lower.includes(s.toLowerCase())) fail(`${doc.route}: malware/cross-site string present → ${s}`);
  for (const s of WP_STRINGS) if (lower.includes(s.toLowerCase())) fail(`${doc.route}: WordPress artefact present → ${s}`);
  if (/position\s*:\s*absolute[^;]*;?\s*(left|top)\s*:\s*-\d{3,}/i.test(doc.html)) {
    fail(`${doc.route}: off-screen hidden-text pattern found`);
  }
}

// ---------------------------------------------------------------- 4. links
const linkRows = [];
let selfLinks = 0;
let broken = 0;

/**
 * Navigation, footer, breadcrumbs, pagination and related-product blocks are
 * structural chrome. They legitimately point at the current page and repeat the
 * same anchors site-wide, so the self-link and anchor-quality rules apply only
 * to contextual links inside the editorial content.
 */
const stripChrome = (html) => html
  .replace(/<header[\s\S]*?<\/header>/gi, '')
  .replace(/<footer[\s\S]*?<\/footer>/gi, '')
  .replace(/<nav[\s\S]*?<\/nav>/gi, '')
  .replace(/<section class="section section--tint" aria-labelledby="related-heading">[\s\S]*?<\/section>/gi, '')
  .replace(/<ul class="grid[\s\S]*?<\/ul>/gi, '')
  .replace(/<form[\s\S]*?<\/form>/gi, '');

for (const doc of docs) {
  const body = doc.html.slice(doc.html.indexOf('<body'));
  const contextual = stripChrome(body);
  for (const m of body.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const rawHref = m[1];
    const anchor = text(m[2]);
    const isContextual = contextual.includes(m[0]);
    if (/^(mailto:|tel:|#)/i.test(rawHref)) continue;

    if (/^https?:\/\//i.test(rawHref)) {
      const host = new URL(rawHref).host;
      if (/insertshub\.com$/i.test(host)) fail(`${doc.route}: internal link uses an absolute URL → ${rawHref}`);
      continue;
    }

    const href = rawHref.split('#')[0];
    if (!href) continue;
    if (!routes.has(href) && !redirects[href]) {
      broken++;
      fail(`${doc.route}: broken internal link → ${href}`);
    }
    if (href === doc.route && isContextual) {
      selfLinks++;
      fail(`${doc.route}: contextual self-link (anchor ${JSON.stringify(anchor)})`);
    }
    if (GONE_CATEGORY_SLUGS.some((s) => href === `/category/${s}/`)) {
      fail(`${doc.route}: links to a 410 spam URL → ${href}`);
    }
    linkRows.push({
      'Source URL': ORIGIN + doc.route,
      'Destination URL': ORIGIN + href,
      Anchor: anchor,
      'Link type': isContextual ? 'contextual' : 'structural',
    });
  }
}

// Generic anchors are banned in contextual copy.
const GENERIC = ['click here', 'learn more', 'read more', 'view product', 'explore', 'here'];
for (const row of linkRows) {
  if (row['Link type'] !== 'contextual') continue;
  if (GENERIC.includes(row.Anchor.toLowerCase())) fail(`${row['Source URL']}: generic anchor "${row.Anchor}"`);
}

// ---------------------------------------------------------------- 5. redirects
for (const [from, to] of Object.entries(redirects)) {
  const dest = typeof to === 'string' ? to : to.destination;
  if (redirects[dest]) fail(`redirect chain: ${from} → ${dest} → ${redirects[dest].destination ?? redirects[dest]}`);
  if (dest === from) fail(`redirect loop: ${from}`);
  if (dest.startsWith('/') && !routes.has(dest) && !dest.endsWith('.xml')) {
    fail(`redirect ${from} points at a non-existent page ${dest}`);
  }
}

// ---------------------------------------------------------------- 6. sitemap
const sitemap = fs.readFileSync(path.join(ROOT, 'dist/client/sitemap.xml'), 'utf8');
const locs = all(sitemap, /<loc>([^<]+)<\/loc>/g);
if (!locs.length) fail('sitemap.xml is empty');
/**
 * Routes that are noindex *by intent* — the thank-you page and the 404. This is
 * deliberately not derived from the rendered meta tag, because a non-live build
 * marks every page noindex; the sitemap still describes the production site.
 */
const noindexRoutes = new Set(['/404/', ...pagesData.filter((p) => p.noindex).map((p) => p.url)]);

for (const loc of locs) {
  if (!loc.startsWith(ORIGIN)) fail(`sitemap contains a non-production URL: ${loc}`);
  const route = loc.slice(ORIGIN.length);
  if (!routes.has(route)) fail(`sitemap lists a URL that was not built: ${loc}`);
  if (noindexRoutes.has(route)) fail(`sitemap lists a noindex page: ${loc}`);
  if (redirects[route]) fail(`sitemap lists a redirected URL: ${loc}`);
  if (/[?#]/.test(loc)) fail(`sitemap contains a query-string URL: ${loc}`);
  if (GONE_CATEGORY_SLUGS.some((s) => route === `/category/${s}/`)) fail(`sitemap contains a spam URL: ${loc}`);
}
if (new Set(locs).size !== locs.length) fail('sitemap contains duplicate URLs');

const indexable = docs.filter((d) => !noindexRoutes.has(d.route)).map((d) => d.route);
for (const route of indexable) {
  if (!locs.includes(ORIGIN + route)) fail(`indexable page missing from sitemap: ${route}`);
}

// ---------------------------------------------------------------- 7. robots
const robotsTxt = fs.readFileSync(path.join(ROOT, 'dist/client/robots.txt'), 'utf8');
if (/vercel\.app/.test(robotsTxt)) fail('robots.txt references a preview host');

/**
 * Indexing is opt-in. Unless this build was made with VERCEL_ENV=production and
 * SITE_LIVE=true, every page must be noindex and robots.txt must disallow all —
 * so a *.vercel.app deployment can never be indexed before DNS cutover.
 */
const indexingAllowed = process.env.VERCEL_ENV === 'production' && String(process.env.SITE_LIVE).toLowerCase() === 'true';
if (indexingAllowed) {
  if (!robotsTxt.includes(`Sitemap: ${ORIGIN}/sitemap.xml`)) fail('robots.txt does not reference the production sitemap');
  for (const doc of docs) {
    const robots = attr(doc.html, /<meta name="robots" content="([^"]*)"/i);
    const shouldBeNoindex = pagesData.find((p) => p.url === doc.route)?.noindex || doc.route === '/404/';
    if (!shouldBeNoindex && !robots.includes('index,follow')) fail(`${doc.route}: expected index,follow in a live production build`);
  }
} else {
  if (!/^User-agent: \*\nDisallow: \/$/m.test(robotsTxt.trim())) {
    fail('non-live build must serve "User-agent: * / Disallow: /" in robots.txt');
  }
  for (const doc of docs) {
    const robots = attr(doc.html, /<meta name="robots" content="([^"]*)"/i);
    if (!robots.includes('noindex')) fail(`${doc.route}: non-live build must be noindex (got "${robots}")`);
  }
  console.log('indexing guard: build is NON-LIVE — all pages noindex, robots.txt disallows all');
}

// ---------------------------------------------------------------- 8. schema
for (const doc of docs) {
  const blocks = all(doc.html, /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  for (const raw of blocks) {
    let parsed;
    try { parsed = JSON.parse(raw); } catch { fail(`${doc.route}: invalid JSON-LD`); continue; }
    const json = JSON.stringify(parsed);
    if (/vercel\.(app|sh)/.test(json)) fail(`${doc.route}: preview host in JSON-LD`);
    if (parsed['@type'] === 'Product') {
      if (parsed.aggregateRating || parsed.review) fail(`${doc.route}: Product schema contains invented review data`);
      const slug = doc.route.replace(/^\/product\/|\/$/g, '');
      const product = products.find((p) => p.slug === slug);
      if (!product) { fail(`${doc.route}: Product schema on a non-product page`); continue; }
      if (parsed.name !== product.name) fail(`${doc.route}: schema name ${parsed.name} != ${product.name}`);
      if (parsed.url !== `${ORIGIN}${product.url}`) fail(`${doc.route}: schema url mismatch`);
      if (parsed.offers?.price !== product.price) fail(`${doc.route}: schema price mismatch`);
      const h1 = text(attr(doc.html, /<h1[^>]*>([\s\S]*?)<\/h1>/i));
      if (h1 !== product.name) fail(`${doc.route}: H1 ${JSON.stringify(h1)} does not match schema name`);
    }
    if (parsed['@type'] === 'FAQPage') {
      const visible = all(doc.html, /<summary><h3>([\s\S]*?)<\/h3><\/summary>/gi).map(text);
      const schemaQs = parsed.mainEntity.map((q) => q.name);
      if (visible.length !== schemaQs.length) {
        fail(`${doc.route}: ${visible.length} visible FAQs vs ${schemaQs.length} in schema`);
      } else {
        schemaQs.forEach((q, i) => {
          if (q !== visible[i]) fail(`${doc.route}: FAQ ${i + 1} schema/visible mismatch: ${JSON.stringify(q)} vs ${JSON.stringify(visible[i])}`);
        });
      }
      for (const q of parsed.mainEntity) {
        const answer = q.acceptedAnswer.text;
        if (!text(doc.html).includes(answer.slice(0, 60))) {
          fail(`${doc.route}: FAQ answer in schema is not visible on the page`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------- 9. coverage
for (const p of products) {
  if (!routes.has(p.url)) fail(`product not built: ${p.url}`);
}
for (const p of pagesData) {
  if (!routes.has(p.url)) fail(`page not built: ${p.url}`);
}

// ---------------------------------------------------------------- 10. orphans
const incoming = new Map();
for (const route of routes) incoming.set(route, 0);
for (const row of linkRows) {
  const route = row['Destination URL'].slice(ORIGIN.length);
  if (incoming.has(route)) incoming.set(route, incoming.get(route) + 1);
}
const orphanRows = [];
for (const [route, count] of incoming) {
  if (route === '/404/' || noindexRoutes.has(route)) continue;
  if (count === 0) {
    orphanRows.push({ URL: ORIGIN + route, 'Incoming links': 0, Status: 'ORPHAN', Note: 'No page links here' });
    fail(`orphan indexable page (no incoming links): ${route}`);
  }
}

// ---------------------------------------------------------------- 11. assets
for (const doc of docs) {
  for (const m of doc.html.matchAll(/<img\b([^>]*)>/gi)) {
    const tag = m[1];
    if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag)) fail(`${doc.route}: <img> without explicit width/height`);
    // compressHTML rewrites alt="" to a bare `alt`, which is equivalent in HTML5.
    if (!/\balt(?=[\s=>]|$)/.test(tag)) fail(`${doc.route}: <img> without an alt attribute`);
  }
}

// ---------------------------------------------------------------- 12. secrets
const SECRET_PATTERNS = [/SMTP_PASS/, /SMTP_USER/, /['"][A-Za-z0-9+/]{40,}={0,2}['"]/];
for (const file of files.filter((f) => f.endsWith('.js') || f.endsWith('.html'))) {
  const content = fs.readFileSync(file, 'utf8');
  if (/SMTP_(PASS|USER|HOST)\s*[:=]\s*['"][^'"]+['"]/.test(content)) {
    fail(`${path.relative(DIST, file)}: possible SMTP credential in a client asset`);
  }
}

// ---------------------------------------------------------------- reports
fs.mkdirSync(REPORTS, { recursive: true });
writeCsv(path.join(REPORTS, 'ORPHAN_PAGE_REPORT.csv'), orphanRows.length ? orphanRows : [
  ...[...incoming].filter(([r]) => r !== '/404/').map(([route, count]) => ({
    URL: ORIGIN + route, 'Incoming links': count, Status: 'linked', Note: '',
  })),
]);

writeCsv(path.join(REPORTS, 'REDIRECT_MAP.csv'), Object.entries(redirects).map(([from, to]) => ({
  'Old URL': ORIGIN + from,
  'New URL': (typeof to === 'string' ? to : to.destination).startsWith('/')
    ? ORIGIN + (typeof to === 'string' ? to : to.destination)
    : (typeof to === 'string' ? to : to.destination),
  'Status code': typeof to === 'string' ? 301 : to.status,
  Hops: 1,
})));

writeCsv(path.join(REPORTS, 'SPAM_URL_MAP.csv'), GONE_CATEGORY_SLUGS.map((slug) => ({
  'Spam URL': `${ORIGIN}/category/${slug}/`,
  Classification: 'Injected doorway category archive',
  'Old status': ['casino', 'casino1', 'casino2', 'casino3', 'casino4', 'casino-online-2', 'new-casino', 'top-casinos', 'melhorcasinoonlineportugal-com'].includes(slug) ? '410' : '200',
  'New status': '410 Gone',
  'In sitemap': 'no',
})));

// ---------------------------------------------------------------- result
console.log(`\nlinks checked: ${linkRows.length}  broken: ${broken}  self-links: ${selfLinks}`);
console.log(`sitemap URLs: ${locs.length}  indexable pages: ${indexable.length}`);
for (const w of warnings) console.log(`WARN  ${w}`);

if (failures.length) {
  console.error(`\n${failures.length} VALIDATION FAILURE(S):`);
  for (const f of failures.slice(0, 60)) console.error(`  ✗ ${f}`);
  if (failures.length > 60) console.error(`  … and ${failures.length - 60} more`);
  process.exit(1);
}
console.log('\n✓ all validation checks passed');
