/**
 * Every legitimate URL from the old site is preserved at the same path, so this
 * map only covers URLs that genuinely cannot survive: the duplicate About page,
 * the WooCommerce cart flow (no storefront in a quote-driven static site), the
 * two never-published draft products, and a casing variant WordPress served at
 * 200 alongside the canonical lowercase slug.
 *
 * Each entry is a single hop to a live 200 page — no chains, no loops, and no
 * spam URL is ever redirected into the legitimate site.
 */
export const redirects = {
  // Duplicate About page (same title/H1 as /about-us/) that also carried injected casino spam.
  '/about-us-2/': { status: 301, destination: '/about-us/' },

  // WooCommerce transactional pages. Inserts Hub sells by quote; these three were
  // the primary carriers of the injected gambling spam and have no organic value.
  '/cart/': { status: 301, destination: '/products/' },
  '/checkout/': { status: 301, destination: '/products/' },
  '/my-account/': { status: 301, destination: '/contact-us/' },

  // Empty product category that was never in the sitemap.
  '/product-category/foam-inserts/': { status: 301, destination: '/products/' },

  // Draft products that 404 on the old site but are still linked from live copy.
  '/product/printed-cardboard-inserts/': { status: 301, destination: '/product/custom-cardboard-inserts/' },
  '/product/recycled-cardboard-inserts/': { status: 301, destination: '/product/custom-kraft-paper-inserts/' },

  // WordPress served this casing variant at 200; fold it into the canonical slug.
  '/product/White-cardboard-inserts/': { status: 301, destination: '/product/white-cardboard-inserts/' },

  // Yoast's sitemap entry point.
  '/sitemap_index.xml': { status: 301, destination: '/sitemap.xml' },
};

/**
 * Spam doorway category archives injected by the malware. The old site has zero
 * blog posts, so the entire /category/ namespace is malicious. These return a
 * real 410 Gone and are absent from the sitemap.
 */
export const GONE_CATEGORY_SLUGS = [
  '1', '25', 'adobe-generative-ai-3-2', 'adobe-generative-ai-8-2', 'bez-rubriki', 'blog',
  'boaboa-pt', 'botteganapule-com', 'casino', 'casino-online-2', 'casino1', 'casino2',
  'casino3', 'casino4', 'cmgv-es', 'computers-games', 'crobar-co-uk-2', 'forex-news',
  'melhorcasinoonlineportugal-com', 'montecatini-cl', 'my-texts', 'new-casino', 'news',
  'om', 'om-cc', 'papeleriaeliris-com-mx', 'public', 'sanodelucas-cl', 'spiele', 'test',
  'top-casinos', 'top-kasyno', 'uncategorized',
];
