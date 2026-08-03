import type { APIRoute } from 'astro';
import { redirectResponse } from '../lib/redirect-response';

export const prerender = false;

/** Yoast's old sitemap entry point, folded into the single /sitemap.xml. */
export const GET: APIRoute = () => redirectResponse('/sitemap_index.xml');
