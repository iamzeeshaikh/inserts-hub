/**
 * Clean-room content extraction.
 *
 * Reads the untrusted WordPress / WooCommerce exports, sanitises every field and
 * writes the structured data the Astro site is generated from, plus the
 * migration reports. Run with `node scripts/build-content.mjs`.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readWxr, readCsv, writeCsv } from './lib/wxr.mjs';
import {
  sanitizeHtml, wpautop, stripTags, decodeEntities, toSitePath, hostOf,
  SPAM_HOSTS, CROSS_SITE_HOSTS, ALLOWED_EXTERNAL_HOSTS,
} from './lib/sanitize.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.resolve(ROOT, '..');
const DATA = path.join(ROOT, 'src', 'data');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(REPORTS, { recursive: true });

const XML = path.join(SRC, 'insertshub.WordPress.2026-08-03.xml');
const CSV = path.join(SRC, 'wc-product-export-3-8-2026-1785752420949.csv');

/**
 * The business phone number changed after the export was taken. It is rewritten
 * everywhere — site config, page copy, tel: links — so no old number survives
 * anywhere in the build. `npm run validate` fails if one reappears.
 */
const PHONE = { display: '(503) 358-0443', href: '+15033580443' };
const OLD_PHONE = /(?:\+?1[-\s.]?)?\(?929\)?[-\s.]?2141[-\s.]?874\b|\+19292141874\b/g;

const replacePhone = (html) =>
  String(html || '')
    .replace(/href="tel:[^"]*"/g, `href="tel:${PHONE.href}"`)
    .replace(OLD_PHONE, PHONE.display);

const items = readWxr(XML);
const wooRows = readCsv(CSV);
const byId = new Map(items.map((i) => [i.id, i]));

const log = [];
const note = (...a) => { log.push(a.join(' ')); console.log(...a); };

// ---------------------------------------------------------------- catalogue
const CATEGORY_META = {
  'cardboard-inserts': {
    name: 'Cardboard Inserts',
    title: 'Cardboard Inserts & Product Packaging Solutions | Inserts Hub',
    description: 'Protect your products with custom cardboard inserts. Single & multi-product layouts, free design help, wholesale pricing & fast USA delivery.',
  },
  product: { name: 'Product', title: 'Product Archives - Inserts Hub', description: '' },
};

/** Products that were drafts on the old site — never published, must not be created. */
const DRAFT_SLUGS = new Map([
  ['printed-cardboard-inserts', '/product/custom-cardboard-inserts/'],
  ['recycled-cardboard-inserts', '/product/custom-kraft-paper-inserts/'],
]);

const products = [];
const contamination = [];
const linkRows = [];
const claimRows = [];

/** Existing commercial / material claims we track so none are silently dropped. */
const CLAIM_PATTERNS = [
  ['wholesale prices', 'Wholesale pricing'], ['free design', 'Free design assistance'],
  ['free shipping', 'Free shipping'], ['fast turnaround', 'Fast turnaround times'],
  ['custom sizes and styles', 'Custom sizes and styles available'],
  ['Gloss, Matte, and Spot UV', 'Gloss / Matte / Spot UV coating options'],
  ['high-quality material', 'High-quality material'], ['printing options', 'Printing options'],
  ['recycl', 'Recycled / recyclable material'], ['eco-friendly', 'Eco-friendly material'],
  ['food grade', 'Food-grade board for food applications'], ['moisture', 'Moisture-resistant coating'],
  ['anti-static', 'Anti-static treatment'], ['die cut', 'Die cutting'],
];

for (const row of wooRows) {
  if (row.Published !== '1') {
    note(`SKIP draft product #${row.ID} ${row.Name}`);
    continue;
  }
  const wp = byId.get(row.ID);
  if (!wp || !wp.slug) throw new Error(`no WXR record / slug for product ${row.ID}`);
  const slug = wp.slug;
  const url = `/product/${slug}/`;
  const catSlug = row.Categories === 'Cardboard Inserts' ? 'cardboard-inserts' : 'product';

  const linkPolicy = makeLinkPolicy(url, contamination, linkRows, `/product/${slug}/`);

  const shortHtml = replacePhone(sanitizeHtml(wpautop(row['Short description']), { linkPolicy }));
  const descHtml = replacePhone(enforceOneLinkPerParagraph(
    sanitizeHtml(wpautop(row.Description), { linkPolicy }), url, linkRows));
  const specsHtml = replacePhone(sanitizeHtml(wpautop(row['Meta: _bhww_specifications_wysiwyg']), { linkPolicy }));
  const faqs = parseFaqs(row['Meta: _bhww_faqs_wysiwyg'], linkPolicy);

  const images = (row.Images || '').split(',').map((s) => s.trim()).filter(Boolean);

  products.push({
    id: row.ID,
    slug,
    url,
    name: decodeEntities(row.Name),
    category: catSlug,
    categoryName: CATEGORY_META[catSlug].name,
    seoTitle: decodeEntities(row['Meta: _yoast_wpseo_title'] || `${row.Name} - Inserts Hub`),
    seoDescription: decodeEntities(row['Meta: _yoast_wpseo_metadesc'] || ''),
    focusKeyword: decodeEntities(row['Meta: _yoast_wpseo_focuskw'] || ''),
    price: row['Regular price'] || '',
    inStock: row['In stock?'] === '1',
    images: images.map(remoteToLocal),
    imageAlts: images.map((u, i) => altFor(row.Name, u, i)),
    shortDescriptionHtml: shortHtml,
    descriptionHtml: descHtml,
    specificationsHtml: specsHtml,
    faqs,
  });

  collectClaims(claimRows, row.Name, url, shortHtml, specsHtml);
}

note(`products migrated: ${products.length}`);

// Related products: same category, excluding self, in catalogue order (matches the old theme).
const byCat = new Map();
for (const p of products) {
  if (!byCat.has(p.category)) byCat.set(p.category, []);
  byCat.get(p.category).push(p);
}
for (const p of products) {
  const siblings = byCat.get(p.category).filter((x) => x.slug !== p.slug);
  p.related = siblings.slice(0, 4).map((x) => x.slug);
  if (p.related.length < 4) {
    const others = products.filter((x) => x.slug !== p.slug && !p.related.includes(x.slug));
    p.related.push(...others.slice(0, 4 - p.related.length).map((x) => x.slug));
  }
}

// ---------------------------------------------------------------- link policy
function makeLinkPolicy(currentUrl, contaminationOut, linkOut, sourceUrl) {
  const live = new Set(products.map((p) => p.url));
  // products array is still filling; resolve lazily against the Woo rows instead
  const publishedSlugs = new Set(
    wooRows.filter((r) => r.Published === '1').map((r) => byId.get(r.ID)?.slug).filter(Boolean));

  return (rawHref) => {
    const href = decodeEntities(rawHref || '').trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
      return { action: 'unwrap' };
    }
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return { action: 'keep' };

    const host = hostOf(href);
    if (host && !/^(?:www\.)?insertshub\.com$/i.test(host)) {
      if (SPAM_HOSTS.has(host)) {
        record(linkOut, sourceUrl, href, 'removed', '', 'Injected gambling-spam link (malware) — deleted.');
        return { action: 'drop' };
      }
      if (CROSS_SITE_HOSTS.has(host)) {
        contaminationOut.push({
          'URL': `https://insertshub.com${sourceUrl}`,
          'Contaminated wording': `Outbound link to ${host}`,
          'Suspected source': 'thecandlepackaging.com (unrelated brand)',
          'Correct Inserts Hub wording': 'Link removed; surrounding Inserts Hub wording kept.',
          'Evidence': 'Host is not insertshub.com and the anchor promotes another company’s products.',
          'Final action': 'Link unwrapped, text preserved',
        });
        record(linkOut, sourceUrl, href, 'removed', '', 'Cross-site link to an unrelated brand — unwrapped.');
        return { action: 'unwrap' };
      }
      if (ALLOWED_EXTERNAL_HOSTS.has(host)) return { action: 'keep' };
      record(linkOut, sourceUrl, href, 'removed', '', 'Unrecognised external host — unwrapped for safety.');
      return { action: 'unwrap' };
    }

    let p = toSitePath(href).split('#')[0].split('?')[0];
    if (!p.startsWith('/')) return { action: 'unwrap' };
    if (!p.endsWith('/')) p += '/';

    const pm = /^\/product\/([^/]+)\/$/.exec(p);
    if (pm) {
      const lower = pm[1].toLowerCase();
      if (publishedSlugs.has(lower)) {
        const fixed = `/product/${lower}/`;
        if (fixed === currentUrl) {
          record(linkOut, sourceUrl, p, 'removed', '', 'Self-link — unwrapped (a page must not link to itself).');
          return { action: 'unwrap' };
        }
        if (fixed !== p) {
          record(linkOut, sourceUrl, p, 'updated', fixed, 'Slug casing corrected to the canonical lowercase URL.');
        } else {
          record(linkOut, sourceUrl, p, 'preserved', fixed, 'Legitimate contextual link preserved unchanged.');
        }
        return { action: 'keep', href: fixed };
      }
      if (DRAFT_SLUGS.has(lower)) {
        const target = DRAFT_SLUGS.get(lower);
        record(linkOut, sourceUrl, p, 'updated', target,
          'Destination was an unpublished draft that 404s on the old site; repointed to the closest live product.');
        return { action: 'keep', href: target };
      }
      record(linkOut, sourceUrl, p, 'removed', '', 'Destination product does not exist — unwrapped.');
      return { action: 'unwrap' };
    }

    const SURVIVING = new Set(['/', '/products/', '/about-us/', '/contact-us/', '/privacy-policy/',
      '/refund_returns/', '/terms-conditions/', '/thank-you/',
      '/product-category/cardboard-inserts/', '/product-category/product/']);
    if (SURVIVING.has(p)) {
      if (p === currentUrl) {
        record(linkOut, sourceUrl, p, 'removed', '', 'Self-link — unwrapped.');
        return { action: 'unwrap' };
      }
      record(linkOut, sourceUrl, p, 'preserved', p, 'Legitimate contextual link preserved unchanged.');
      return { action: 'keep', href: p };
    }
    record(linkOut, sourceUrl, p, 'removed', '', 'Destination retired or never existed — unwrapped.');
    return { action: 'unwrap' };
  };
}

function record(out, source, dest, disposition, replacement, reason) {
  out.push({ source, dest, disposition, replacement, reason });
}

/** House rule: never two contextual links inside one paragraph. */
function enforceOneLinkPerParagraph(html, sourceUrl, linkOut) {
  return html.replace(/<p>([\s\S]*?)<\/p>/g, (m, inner) => {
    let seen = 0;
    const fixed = inner.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/g, (am, text) => {
      seen++;
      if (seen === 1) return am;
      record(linkOut, sourceUrl, '(second link in paragraph)', 'removed', '',
        'Removed to honour the one-contextual-link-per-paragraph rule.');
      return text;
    });
    return `<p>${fixed}</p>`;
  });
}

// ---------------------------------------------------------------- FAQs
function parseFaqs(raw, linkPolicy) {
  const html = String(raw || '').replace(/\\r\\n|\\n/g, '\n');
  const out = [];
  const re = /<h3\b[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|$)/gi;
  let m;
  while ((m = re.exec(html))) {
    const question = stripTags(m[1]).replace(/^\s*\d+\.\s*/, '').trim();
    const answer = sanitizeHtml(wpautop(m[2]), { linkPolicy });
    const answerText = stripTags(answer);
    if (question && answerText) out.push({ question, answer, answerText });
  }
  return out;
}

// ---------------------------------------------------------------- media
function remoteToLocal(u) {
  const file = decodeURIComponent(u.split('/').pop() || '').replace(/[^A-Za-z0-9._-]/g, '-');
  return `/images/products/${file}`;
}

function altFor(name, url, i) {
  const base = decodeURIComponent(url.split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
  return i === 0 ? decodeEntities(name) : base || `${decodeEntities(name)} image ${i + 1}`;
}

// ---------------------------------------------------------------- claims
function collectClaims(out, name, url, ...blobs) {
  const text = stripTags(blobs.join(' ')).toLowerCase();
  for (const [needle, label] of CLAIM_PATTERNS) {
    if (text.includes(needle.toLowerCase())) {
      out.push({
        Claim: label, Source: 'WooCommerce CSV export (short description / specifications)',
        'Source URL': `https://insertshub.com${url}`, 'Relevant page': name,
        'Final wording': 'Preserved verbatim from the export',
        'Preserved or normalized': 'Preserved', 'Source conflict resolution': 'No conflict',
      });
    }
  }
}

// ---------------------------------------------------------------- pages
const PAGE_DEFS = [
  { id: '429', url: '/about-us/', slug: 'about-us', h1: 'About Us', title: 'About Us - Inserts Hub',
    description: 'Learn about Inserts Hub, a wholesale supplier of custom packaging inserts for businesses of every size.' },
  { id: '431', url: '/contact-us/', slug: 'contact-us', h1: 'We’re Here to Help!',
    title: 'Contact Inserts Hub | Custom Packaging Inserts',
    description: 'Contact Inserts Hub for custom cardboard, corrugated, foam, kraft, paperboard, molded pulp inserts, trays, dividers, and holders.' },
  { id: '426', url: '/privacy-policy/', slug: 'privacy-policy', h1: 'Privacy Policy', title: 'Privacy Policy - Inserts Hub',
    description: 'How Inserts Hub collects, uses and protects the information you share with us.' },
  { id: '10', url: '/refund_returns/', slug: 'refund_returns', h1: 'Refund and Returns Policy',
    title: 'Refund and Returns Policy - Inserts Hub',
    description: 'Read the Inserts Hub refund and returns policy for custom packaging insert orders.' },
  { id: '424', url: '/terms-conditions/', slug: 'terms-conditions', h1: 'Terms & Conditions',
    title: 'Terms & Conditions - Inserts Hub',
    description: 'The terms and conditions that apply to orders placed with Inserts Hub.' },
  { id: '2968', url: '/thank-you/', slug: 'thank-you', h1: 'Thank you', title: 'Thank You - Inserts Hub',
    description: 'Thank you for contacting Inserts Hub. Our team will reply to your enquiry shortly.', noindex: true },
];

const pages = [];
for (const def of PAGE_DEFS) {
  const wp = byId.get(def.id);
  if (!wp) throw new Error(`missing page ${def.id}`);
  const linkPolicy = makeLinkPolicy(def.url, contamination, linkRows, def.url);
  let body = extractPageBody(wp.content, def);
  body = replacePhone(body);
  body = sanitizeHtml(body, { linkPolicy });
  body = enforceOneLinkPerParagraph(body, def.url, linkRows);
  pages.push({ ...def, bodyHtml: body });
  note(`page ${def.url} -> ${stripTags(body).length} chars`);
}

/**
 * The WXR stores a *rendered* Elementor snapshot. Pull out the editorial body and
 * discard chrome (header, footer, quote form, trust badges) which the Astro
 * layout supplies, along with anything the malware injected.
 */
function extractPageBody(rendered, def) {
  let html = String(rendered || '');
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<link\b[^>]*>/gi, '');
  html = html.replace(/<svg[\s\S]*?<\/svg>/gi, '');
  // Strip WordPress / Elementor / WooCommerce shortcodes — they have no meaning here.
  html = html.replace(/\[\/?(?:elementor-template|woocommerce_[a-z_]+|contact-form-7|gallery|caption|embed|vc_[a-z_]+|products?|rev_slider)\b[^\]]*\]/gi, '');
  // Drop the shared "Get a Custom Quote" block and everything after it.
  const cut = html.search(/Get a Custom Quote for Inserts|elementor-2174|Looking for custom inserts or need bulk pricing/i);
  if (cut > 0) html = html.slice(0, cut);
  // Drop the page H1 — the template renders it.
  html = html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, '');
  // The Elementor snapshot repeats the heading as bare text; the template owns it now.
  const h1 = def.h1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]");
  html = html.replace(new RegExp(`(^|>)\\s*${h1}\\s*(<|$)`, 'i'), '$1$2');
  // Promote the emphasised lead-ins the theme rendered as bold standalone lines.
  html = html.replace(/<p>\s*<strong>\s*([^<]{3,80}?)\s*<\/strong>\s*<\/p>/gi, '<h2>$1</h2>');
  html = html.replace(/(^|\n)\s*<strong>\s*([^<]{3,80}?)\s*<\/strong>\s*(?=\n|<ul|<ol|$)/gi, '$1<h2>$2</h2>');
  // The thank-you page's only body content duplicates its heading.
  if (def.slug === 'thank-you') html = '';
  return html;
}

// ---------------------------------------------------------------- write data
const site = {
  origin: 'https://insertshub.com',
  name: 'Inserts Hub',
  tagline: 'FIT. PROTECT. DELIVER.',
  email: 'info@insertshub.com',
  phone: PHONE.display,
  phoneHref: PHONE.href,
  address: { street: '3409 N 7th Ave Unit #529', locality: 'Phoenix', region: 'AZ', postalCode: '85013', country: 'US' },
  addressLine: '3409 N 7th Ave Unit #529 Phoenix, AZ 85013',
  social: { facebook: 'https://www.facebook.com/insertshub/', linkedin: 'https://www.linkedin.com/company/105388524/' },
  copyright: 'Copyright © Inserts Hub 2024',
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products/' },
    { label: 'About Us', href: '/about-us/' },
    { label: 'Contact Us', href: '/contact-us/' },
    { label: 'Refund and Returns Policy', href: '/refund_returns/' },
  ],
  footerCompany: [
    { label: 'About Us', href: '/about-us/' },
    { label: 'Contact Us', href: '/contact-us/' },
    { label: 'Privacy Policy', href: '/privacy-policy/' },
    { label: 'Refund and Returns Policy', href: '/refund_returns/' },
    { label: 'Terms & Conditions', href: '/terms-conditions/' },
  ],
  footerTopProducts: [
    'candle-boxes-with-inserts', 'candy-box-inserts', 'chocolate-box-inserts',
    'cookie-boxes-with-inserts', 'custom-foam-inserts', 'custom-kraft-paper-inserts',
  ],
  /**
   * Hero slider, rebuilt from the supplied Elementor slide templates
   * (#2722 Slide 1, #2730 Slide 2, #2736 Slide 3). Each is a 50/50 row with the
   * image on the left and heading + copy + a centred pill button on the right.
   * Slide 1 carries the page's <h1>.
   *
   * The templates reference `*-1.jpg` images that now 404 — they were replaced
   * by .webp versions during a media cleanup and the slides were never updated.
   * The current files of the same subjects are used instead.
   */
  slides: [
    {
      h1: true,
      heading: 'Custom Inserts for Every Need',
      text: 'From foam inserts to cardboard dividers, find the perfect fit for all your packaging requirements at wholesale prices.',
      cta: { label: 'Shop Now', href: '/products/' },
      image: '/images/site/Corrugated-Cardboard-Inserts-Packaging.webp',
    },
    {
      heading: 'Bulk Orders, Big Savings',
      text: 'Buy custom inserts in bulk and save on premium quality packaging solutions for your business',
      cta: { label: 'Get a Quote', href: '#quote' },
      image: '/images/site/Mini-Cupcake-Inserts.webp',
    },
    {
      heading: 'Secure Your Products with Precision',
      text: 'Explore our range of inserts designed to protect and display your products beautifully. Custom options available!',
      cta: { label: 'Explore Our Collection', href: '/products/' },
      image: '/images/site/Cardboard-Divider-Inserts-Packaging.webp',
    },
  ],
  homeFeatures: [
    { title: 'Custom Design, Sizes & Style', image: '/images/site/boxes-gif-unscreen.gif', tint: true },
    { title: 'Custom Design, Sizes & Style', image: '/images/site/gif-boxes.gif', tint: true },
    { title: 'High Quality Offset Printing', image: '/images/site/Offset-Press.gif', tint: false },
    { title: 'Fast Shipping 8-10 Business Days', image: '/images/site/Delivery-Icon-Giff.gif', tint: false },
  ],
  homeOrder: ['white-cardboard-inserts', 'kraft-cardboard-inserts', 'rigid-box-cardboard-inserts',
    'cardboard-box-divider-inserts', 'die-cut-cardboard-inserts', 'corrugated-inserts',
    'molded-pulp-inserts', 'custom-boxes-with-foam-inserts', 'carton-inserts',
    'custom-plastic-inserts', 'cardboard-inserts-for-bags', 'die-cut-inserts',
    'product-packaging-inserts', 'custom-cardboard-inserts', 'cardboard-divider-inserts',
    'pizza-box-inserts', 'chocolate-box-inserts', 'foam-inserts-for-gift-boxes',
    'cookie-boxes-with-inserts', 'truffle-boxes-with-inserts', 'custom-paperboard-inserts',
    'custom-corrugated-cardboard-inserts', 'custom-kraft-paper-inserts', 'custom-foam-inserts',
    'cupcake-boxes-with-inserts', 'cardboard-box-inserts', 'box-divider-inserts',
    'candle-boxes-with-inserts', 'mailer-box-inserts', 'candy-box-inserts', 'mini-cupcake-inserts'],
  categories: Object.entries(CATEGORY_META).map(([slug, m]) => ({ slug, ...m })),
  quoteIntro: 'Looking for custom inserts or need bulk pricing? Fill out the form below, and our team will get back to you with a tailored quote. Let us know your requirements, and we’ll find the perfect solution for your packaging needs.',
  perPage: 16,
};

fs.writeFileSync(path.join(DATA, 'products.json'), JSON.stringify(products, null, 1));
fs.writeFileSync(path.join(DATA, 'pages.json'), JSON.stringify(pages, null, 1));
fs.writeFileSync(path.join(DATA, 'site.json'), JSON.stringify(site, null, 1));

// sanity: every slug referenced by site.json exists
const slugSet = new Set(products.map((p) => p.slug));
for (const s of [...site.homeOrder, ...site.footerTopProducts]) {
  if (!slugSet.has(s)) throw new Error(`site.json references unknown product slug: ${s}`);
}
if (site.homeOrder.length !== products.length) {
  throw new Error(`homeOrder has ${site.homeOrder.length} slugs but ${products.length} products exist`);
}

// ---------------------------------------------------------------- image manifest
const manifest = [];
for (const p of products) {
  const raw = (wooRows.find((r) => r.ID === p.id).Images || '').split(',').map((s) => s.trim()).filter(Boolean);
  raw.forEach((remote, i) => {
    manifest.push({ remote, local: p.images[i], page: p.url, alt: p.imageAlts[i], role: i === 0 ? 'primary' : 'gallery' });
  });
}
for (const s of site.slides) manifest.push({ remote: siteImage(s.image), local: s.image, page: '/', alt: s.heading, role: 'slide' });
for (const f of site.homeFeatures) manifest.push({ remote: siteImage(f.image), local: f.image, page: '/', alt: f.title, role: 'feature' });
manifest.push({ remote: 'https://insertshub.com/wp-content/uploads/2025/04/check-mark-gree.jpg', local: '/images/site/check-mark-green.jpg', page: '/thank-you/', alt: 'Your message has been sent', role: 'confirmation' });
manifest.push({ remote: 'https://insertshub.com/wp-content/uploads/2024/10/Inserts-Hub-500-x-300.png', local: '/images/site/Inserts-Hub-logo.png', page: 'header', alt: 'Inserts Hub — fit, protect, deliver', role: 'logo' });
manifest.push({ remote: 'https://insertshub.com/wp-content/uploads/2024/10/certificate.png', local: '/images/site/certificate.png', page: 'footer', alt: 'DMCA Protected, SiteLock secure, McAfee secure and BBB accredited business badges', role: 'badge' });
manifest.push({ remote: 'https://insertshub.com/wp-content/uploads/2024/10/cropped-Inserts-Hub-500-x-200-32x32.png', local: '/images/site/favicon-32.png', page: 'head', alt: 'Inserts Hub', role: 'favicon' });

function siteImage(local) {
  const f = local.split('/').pop();
  const map = {
    'Corrugated-Cardboard-Inserts-Packaging.webp': '2024/10', 'Mini-Cupcake-Inserts.webp': '2024/10',
    'Cardboard-Divider-Inserts-Packaging.webp': '2024/10', 'boxes-gif-unscreen.gif': '2024/08',
    'gif-boxes.gif': '2024/08', 'Offset-Press.gif': '2024/08', 'Delivery-Icon-Giff.gif': '2024/08',
  };
  return `https://insertshub.com/wp-content/uploads/${map[f]}/${f}`;
}

fs.writeFileSync(path.join(ROOT, 'scripts', 'image-manifest.json'), JSON.stringify(manifest, null, 1));
note(`image manifest: ${manifest.length} entries`);

// ---------------------------------------------------------------- reports
writeCsv(path.join(REPORTS, 'INTERNAL_LINK_MAP.csv'),
  linkRows.map((r) => ({
    'Source URL': `https://insertshub.com${r.source}`,
    'Old destination': r.dest.startsWith('/') ? `https://insertshub.com${r.dest}` : r.dest,
    'Final disposition': r.disposition,
    'Replacement URL': r.replacement ? `https://insertshub.com${r.replacement}` : '',
    'Link type': 'contextual',
    'Reason': r.reason,
  })));

writeCsv(path.join(REPORTS, 'CONTENT_CONTAMINATION_REPORT.csv'), contamination.length ? contamination : [{
  'URL': '', 'Contaminated wording': '', 'Suspected source': '', 'Correct Inserts Hub wording': '',
  'Evidence': '', 'Final action': '',
}]);

const seenClaim = new Set();
writeCsv(path.join(REPORTS, 'CLAIMS_MIGRATION_DATA.csv'), claimRows.filter((c) => {
  const k = c.Claim + c['Source URL'];
  if (seenClaim.has(k)) return false;
  seenClaim.add(k);
  return true;
}));

writeCsv(path.join(REPORTS, 'CONTENT_INVENTORY.csv'), [
  ...pages.map((p) => ({
    URL: `https://insertshub.com${p.url}`, Type: 'page', Title: p.title, H1: p.h1,
    'Meta description': p.description, 'Body characters': stripTags(p.bodyHtml).length,
    Indexable: p.noindex ? 'noindex,follow' : 'index,follow', Source: 'WordPress XML export (rendered snapshot)',
  })),
  ...products.map((p) => ({
    URL: `https://insertshub.com${p.url}`, Type: 'product', Title: p.seoTitle, H1: p.name,
    'Meta description': p.seoDescription,
    'Body characters': stripTags(p.descriptionHtml + p.specificationsHtml).length,
    Indexable: 'index,follow', Source: 'WooCommerce CSV export',
  })),
]);

fs.writeFileSync(path.join(REPORTS, 'build-content.log'), log.join('\n') + '\n');
note('content build complete');
