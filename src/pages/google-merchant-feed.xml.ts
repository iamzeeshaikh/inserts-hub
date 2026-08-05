/**
 * Google Merchant Center product feed (RSS 2.0 with the g: namespace).
 *
 * Same arrangement as kraftboxpack.com: the WooCommerce site fed Merchant
 * Center over the Content API, this static feed replaces that sync. Merchant
 * Center fetches it on a schedule from
 * https://insertshub.com/google-merchant-feed.xml.
 *
 * Offer ids reuse the WordPress post ids as `gla_<post id>` — the format the
 * "Google for WooCommerce" plugin submitted — so Merchant Center updates the
 * items it already approved instead of reviewing 31 new ones. If the ids in
 * the Merchant Center products list are NOT of that form, change OFFER_ID
 * only; everything else stays.
 */
import type { APIRoute } from 'astro';
import products from '../data/products.json';
import site from '../data/site.json';
import { asset, hasAsset } from '../lib/images';

const OFFER_ID = (postId: string) => `gla_${postId}`;

const abs = (path: string) => new URL(path, site.origin).href;

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

export const GET: APIRoute = () => {
  const items = products.map((p) => {
    const images = p.images.filter(hasAsset).map((path) => abs(asset(path).src));
    const price = Number.parseFloat(p.price);
    const description =
      p.seoDescription ||
      plain(p.shortDescriptionHtml || '') ||
      `Custom ${p.name.toLowerCase()} at wholesale prices from ${site.name}.`;

    const lines = [
      `<g:id>${esc(OFFER_ID(p.id))}</g:id>`,
      `<g:title>${esc(p.name)}</g:title>`,
      `<g:description>${esc(description)}</g:description>`,
      `<g:link>${esc(abs(p.url))}</g:link>`,
      ...(images.length ? [`<g:image_link>${esc(images[0])}</g:image_link>`] : []),
      ...images.slice(1, 11).map((u) => `<g:additional_image_link>${esc(u)}</g:additional_image_link>`),
      `<g:availability>${p.inStock ? 'in_stock' : 'out_of_stock'}</g:availability>`,
      ...(Number.isFinite(price) ? [`<g:price>${price.toFixed(2)} USD</g:price>`] : []),
      `<g:condition>new</g:condition>`,
      `<g:brand>${esc(site.name)}</g:brand>`,
      // Made-to-order packaging inserts have no GTIN or manufacturer number.
      `<g:identifier_exists>no</g:identifier_exists>`,
      // "Product" is WooCommerce's default uncategorised bucket, not a real type.
      ...(p.categoryName && p.categoryName !== 'Product'
        ? [`<g:product_type>${esc(p.categoryName)}</g:product_type>`]
        : []),
    ];

    return `<item>\n${lines.map((l) => `  ${l}`).join('\n')}\n</item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${esc(site.name)}</title>
<link>${esc(abs('/'))}</link>
<description>${esc(`${site.name} product feed for Google Merchant Center`)}</description>
${items.join('\n')}
</channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
