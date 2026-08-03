import type { APIRoute } from 'astro';
import { site, products, pages, alphabetical, productsInCategory } from '../lib/site';

/**
 * Hand-built sitemap so we control exactly what ships: only indexable 200 pages
 * on the production origin. No preview host, no query strings, no noindex page,
 * no redirect target and no spam URL can appear here.
 */
export const GET: APIRoute = () => {
  const urls: Array<{ loc: string; priority: string }> = [];
  const add = (path: string, priority: string) => urls.push({ loc: `${site.origin}${path}`, priority });

  add('/', '1.0');

  const productPages = Math.ceil(alphabetical.length / site.perPage);
  for (let n = 1; n <= productPages; n++) add(n === 1 ? '/products/' : `/products/page/${n}/`, n === 1 ? '0.9' : '0.5');

  for (const category of site.categories) {
    const total = Math.ceil(productsInCategory(category.slug).length / site.perPage);
    for (let n = 1; n <= total; n++) {
      const base = `/product-category/${category.slug}/`;
      add(n === 1 ? base : `${base}page/${n}/`, n === 1 ? '0.8' : '0.4');
    }
  }

  for (const p of products) add(p.url, '0.8');
  for (const p of pages) if (!p.noindex) add(p.url, '0.6');

  const seen = new Set<string>();
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls
      .filter((u) => (seen.has(u.loc) ? false : (seen.add(u.loc), true)))
      .map((u) => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};
