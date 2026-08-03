/**
 * Indexability guard.
 *
 * A build is allowed to say `index,follow` only when BOTH are true:
 *
 *   1. Vercel reports `VERCEL_ENV=production`, and
 *   2. `SITE_LIVE=true` is explicitly set.
 *
 * The second condition is the important one. Vercel promotes the first
 * deployment of a new project to the production target automatically, so
 * `VERCEL_ENV` alone would let a `*.vercel.app` host serve an indexable copy of
 * the site before DNS cutover. Requiring an explicit opt-in means every
 * deployment is `noindex,nofollow` until someone deliberately turns indexing on
 * — which should happen only once insertshub.com actually points here.
 *
 * Local builds are also non-indexable, which keeps `dist/` safe to inspect.
 */
const env = (key: string): string =>
  String((import.meta.env as Record<string, unknown>)[key] ?? process.env[key] ?? '');

const isVercelProduction = env('VERCEL_ENV') === 'production';
const optedIn = env('SITE_LIVE').toLowerCase() === 'true';

export const isIndexable: boolean = isVercelProduction && optedIn;

/** Kept for readability at call sites: anything not indexable is treated as a preview. */
export const isPreview: boolean = !isIndexable;
