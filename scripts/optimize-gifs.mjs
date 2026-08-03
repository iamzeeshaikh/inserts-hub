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

  // These render at 194px wide at most, so 260px still covers a comfortable 1.3x
  // on the widest card; they are small decorative loops, not detail images. One source GIF is 1600x1200 across many frames, which
  // exceeds sharp's default pixel guard — raised for these four known-good
  // local files only.
  const output = await sharp(input, { animated: true, limitInputPixels: false })
    .resize({ width: 260, withoutEnlargement: true })
    .webp({ quality: 58, effort: 6, alphaQuality: 70, smartSubsample: true })
    .toBuffer();

  fs.writeFileSync(dest, output);
  before += input.length;
  after += output.length;
  const pct = Math.round((1 - output.length / input.length) * 100);
  console.log(`  ${file.padEnd(28)} ${(input.length / 1024).toFixed(0).padStart(5)}KB -> ${(output.length / 1024).toFixed(0).padStart(4)}KB  (-${pct}%)`);
}

console.log(`\ntotal ${(before / 1024 / 1024).toFixed(2)}MB -> ${(after / 1024 / 1024).toFixed(2)}MB`);
