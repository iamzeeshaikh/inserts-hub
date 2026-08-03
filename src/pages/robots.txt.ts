import type { APIRoute } from 'astro';
import { site } from '../lib/site';
import { isPreview } from '../lib/env';

/**
 * Preview deployments are disallowed wholesale; production allows everything
 * except the form endpoint. The sitemap reference always points at the
 * production origin so a preview host can never be advertised to crawlers.
 */
export const GET: APIRoute = () => {
  const body = isPreview
    ? ['User-agent: *', 'Disallow: /', ''].join('\n')
    : [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        '',
        `Sitemap: ${site.origin}/sitemap.xml`,
        '',
      ].join('\n');

  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
