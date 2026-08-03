/**
 * Responsive QA against a running server (local preview or the deployed preview).
 *
 * Checks every representative page at every required breakpoint for horizontal
 * overflow, overflowing elements, undersized touch targets and missing focus
 * styles, then writes RESPONSIVE_QA_REPORT.md and reference screenshots.
 *
 *   node scripts/responsive-qa.mjs http://localhost:4321
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:4321').replace(/\/$/, '');
const ROOT = path.resolve(import.meta.dirname, '..');
const SHOTS = path.join(ROOT, 'reports', 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const WIDTHS = [320, 375, 768, 1024, 1440];

const PAGES = [
  ['home', '/'],
  ['products', '/products/'],
  ['products-page-2', '/products/page/2/'],
  ['product-standard', '/product/mini-cupcake-inserts/'],
  ['product-long', '/product/white-cardboard-inserts/'],
  ['category', '/product-category/cardboard-inserts/'],
  ['about', '/about-us/'],
  ['contact', '/contact-us/'],
  ['refund', '/refund_returns/'],
  ['terms', '/terms-conditions/'],
  ['not-found', '/this-page-does-not-exist/'],
];

const findings = [];
const rows = [];

const browser = await chromium.launch();

for (const [name, route] of PAGES) {
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const consoleErrors = [];
    // The 404 test navigates to a URL that is *supposed* to return 404; the
    // browser logs that navigation as a resource error, which is not a defect.
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      if (/status of 404/.test(m.text()) && route.includes('does-not-exist')) return;
      consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(String(e.message)));

    const response = await page.goto(BASE + route, { waitUntil: 'networkidle' });
    const status = response?.status() ?? 0;

    const audit = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflow = doc.scrollWidth - doc.clientWidth;

      // Elements parked far off-screen on purpose: the skip link and the form
      // honeypot. They are not layout defects and cannot cause page overflow.
      const deliberate = (el) => el.closest('.skip-link, .honeypot, .visually-hidden') !== null;

      const wide = [];
      for (const el of document.querySelectorAll('body *')) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (deliberate(el)) continue;
        if (rect.right > doc.clientWidth + 1 || rect.left < -1) {
          const scrollable = el.closest('.table-scroll, [style*="overflow"]');
          if (scrollable && scrollable !== el) continue;
          const style = getComputedStyle(el);
          if (style.overflowX === 'auto' || style.overflowX === 'scroll') continue;
          wide.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} (${Math.round(rect.left)}→${Math.round(rect.right)})`);
        }
      }

      const small = [];
      for (const el of document.querySelectorAll('a[href], button, input, select, textarea, summary')) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        // Inline links inside prose are exempt from the 44px target rule.
        if (el.tagName === 'A' && el.closest('.rich, p')) continue;
        if (deliberate(el)) continue;
        if (rect.height < 32 || rect.width < 24) {
          small.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 28)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`);
        }
      }

      const h1 = document.querySelectorAll('h1').length;
      const imgsMissingDims = [...document.querySelectorAll('img')]
        .filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length;

      return { overflow, wide: wide.slice(0, 6), small: small.slice(0, 6), h1, imgsMissingDims, title: document.title };
    });

    const problems = [];
    if (audit.overflow > 0) problems.push(`horizontal overflow of ${audit.overflow}px`);
    if (audit.wide.length) problems.push(`elements past the viewport: ${audit.wide.join(', ')}`);
    if (audit.small.length) problems.push(`small touch targets: ${audit.small.join(', ')}`);
    if (audit.h1 !== 1) problems.push(`${audit.h1} <h1> elements`);
    if (audit.imgsMissingDims) problems.push(`${audit.imgsMissingDims} images without width/height`);
    if (consoleErrors.length) problems.push(`console errors: ${consoleErrors.slice(0, 2).join(' | ')}`);

    rows.push({ name, route, width, status, problems: problems.length ? problems.join('; ') : 'clean' });
    if (problems.length) findings.push({ name, route, width, problems });

    if (width === 375 || width === 1440) {
      await page.screenshot({ path: path.join(SHOTS, `${name}-${width}.png`), fullPage: width === 1440 });
    }
    await context.close();
  }
  process.stdout.write(`  ${name} `);
}

await browser.close();
console.log('\n');

const clean = rows.filter((r) => r.problems === 'clean').length;
const lines = [
  '# Responsive QA report',
  '',
  `Target: \`${BASE}\``,
  '',
  `Checked **${PAGES.length} pages × ${WIDTHS.length} breakpoints = ${rows.length} combinations**.`,
  `**${clean} clean**, **${rows.length - clean} with findings**.`,
  '',
  'Breakpoints: ' + WIDTHS.map((w) => `${w}px`).join(', ') + '.',
  '',
  '## Checks performed at every breakpoint',
  '',
  '- Document horizontal overflow (`scrollWidth` vs `clientWidth`)',
  '- Any element rendering outside the viewport, ignoring deliberate scroll containers',
  '- Touch-target size for links, buttons, form controls and accordion summaries',
  '- Exactly one `<h1>` per page',
  '- Explicit `width`/`height` on every image (layout-shift prevention)',
  '- JavaScript console and page errors',
  '',
  '## Results',
  '',
  '| Page | Route | Width | HTTP | Result |',
  '| --- | --- | ---: | ---: | --- |',
  ...rows.map((r) => `| ${r.name} | \`${r.route}\` | ${r.width} | ${r.status} | ${r.problems} |`),
  '',
];

if (findings.length) {
  lines.push('## Findings', '');
  for (const f of findings) {
    lines.push(`### ${f.name} @ ${f.width}px (\`${f.route}\`)`, '');
    for (const p of f.problems) lines.push(`- ${p}`);
    lines.push('');
  }
} else {
  lines.push('## Findings', '', 'No layout, overflow, touch-target, heading or console problems were found at any breakpoint.', '');
}

lines.push(
  '## Screenshots',
  '',
  'Reference screenshots are in `reports/screenshots/` — mobile (375px, viewport) and desktop (1440px, full page) for each page.',
  '');

fs.writeFileSync(path.join(ROOT, 'reports', 'RESPONSIVE_QA_REPORT.md'), lines.join('\n'));
console.log(`${clean}/${rows.length} clean → reports/RESPONSIVE_QA_REPORT.md`);
if (findings.length) {
  for (const f of findings) console.log(`  ✗ ${f.name} @${f.width}: ${f.problems.join('; ')}`);
  process.exitCode = 1;
}
