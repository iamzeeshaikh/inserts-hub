import { redirects } from './redirects.mjs';

/**
 * Emits the 301 for a retired URL.
 *
 * These are implemented as real routes rather than through Astro's `redirects`
 * config because the Vercel adapter generates its redirect patterns without a
 * trailing slash (`^/cart$`), while `trailingSlash: 'always'` inserts a 308
 * slash-normalising rule *ahead* of them. The normaliser therefore rewrites
 * `/cart` to `/cart/`, which no longer matches, and the redirect never fires.
 * Owning the response here keeps every retired URL a single 301 hop to a live
 * page on any host.
 */
export function redirectResponse(from: string): Response {
  const entry = redirects[from as keyof typeof redirects];
  if (!entry) throw new Error(`no redirect configured for ${from}`);
  const destination = typeof entry === 'string' ? entry : entry.destination;
  const status = typeof entry === 'string' ? 301 : entry.status;

  return new Response(null, {
    status,
    headers: {
      location: destination,
      'cache-control': 'public, max-age=0, s-maxage=86400',
    },
  });
}
