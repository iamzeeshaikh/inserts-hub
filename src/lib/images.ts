/**
 * Resolves the `/images/...` paths stored in the migrated data to the imported
 * assets Astro's image pipeline can optimise. Product data holds plain strings,
 * so this glob is the bridge between the data layer and `astro:assets`.
 */
import type { ImageMetadata } from 'astro';

const assets = import.meta.glob<{ default: ImageMetadata }>(
  ['../assets/**/*.{jpeg,jpg,png,webp,avif}', '!../assets/**/._*'],
  { eager: true },
);

const byPath = new Map<string, ImageMetadata>();
for (const [file, mod] of Object.entries(assets)) {
  // macOS AppleDouble sidecars (`._foo.jpg`) are metadata, not images.
  if (file.split('/').pop()?.startsWith('._')) continue;
  byPath.set(file.replace('../assets/', '/images/'), mod.default);
}

export function asset(path: string): ImageMetadata {
  const found = byPath.get(path);
  if (!found) throw new Error(`missing migrated image asset: ${path}`);
  return found;
}

export function hasAsset(path: string): boolean {
  return byPath.has(path);
}
