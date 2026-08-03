// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

/**
 * The canonical production origin never changes, even on preview deployments —
 * previews are marked noindex instead, so no preview host can leak into
 * canonicals, schema, Open Graph tags or the sitemap.
 */
export default defineConfig({
  site: 'https://insertshub.com',
  output: 'static',
  adapter: vercel({ imageService: false }),
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  compressHTML: true,
  image: { responsiveStyles: true, layout: 'constrained' },
  devToolbar: { enabled: false },
});
