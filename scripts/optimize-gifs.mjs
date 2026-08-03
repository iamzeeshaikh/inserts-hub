/**
 * Converts the homepage feature GIFs to animated WebP.
 *
 * Astro's image pipeline flattens animation, so these four files are served
 * from public/ verbatim — and as GIFs they were 2.8 MB, which pushed homepage
 * LCP to 2.9 s. Animated WebP keeps the animation at a fraction of the bytes.
 * The original GIF stays on disk as the <picture> fallback for the handful of
 * browsers without animated-WebP support; they are never fetched otherwise.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'public', 'images', 'site');

const gifs = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.gif'));
let before = 0;
let after = 0;

for (const file of gifs) {
  const src = path.join(DIR, file);
  const dest = src.replace(/\.gif$/i, '.webp');
  const input = fs.readFileSync(src);

  // These render at 194px wide at most, so 400px covers 2x displays. One of the
  // source GIFs is 1600x1200 across many frames, which exceeds sharp's default
  // pixel guard — raised deliberately for these four known-good local files.
  const output = await sharp(input, { animated: true, limitInputPixels: false })
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 72, effort: 6 })
    .toBuffer();

  fs.writeFileSync(dest, output);
  before += input.length;
  after += output.length;
  const pct = Math.round((1 - output.length / input.length) * 100);
  console.log(`  ${file.padEnd(28)} ${(input.length / 1024).toFixed(0).padStart(5)}KB -> ${(output.length / 1024).toFixed(0).padStart(4)}KB  (-${pct}%)`);
}

console.log(`\ntotal ${(before / 1024 / 1024).toFixed(2)}MB -> ${(after / 1024 / 1024).toFixed(2)}MB`);
