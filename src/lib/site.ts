/**
 * Typed access to the migrated data, with validation that fails the build rather
 * than shipping a broken catalogue.
 */
import siteJson from '../data/site.json';
import productsJson from '../data/products.json';
import pagesJson from '../data/pages.json';
import dimsJson from '../data/image-dimensions.json';

export interface Faq { question: string; answer: string; answerText: string }

export interface Product {
  id: string;
  slug: string;
  url: string;
  name: string;
  category: string;
  categoryName: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  price: string;
  inStock: boolean;
  images: string[];
  imageAlts: string[];
  shortDescriptionHtml: string;
  descriptionHtml: string;
  specificationsHtml: string;
  faqs: Faq[];
  related: string[];
}

export interface Page {
  id: string;
  url: string;
  slug: string;
  h1: string;
  title: string;
  description: string;
  bodyHtml: string;
  noindex?: boolean;
}

export interface NavItem { label: string; href: string }
export interface Slide {
  h1?: boolean; heading: string; text: string;
  cta: { label: string; href: string }; image: string;
}
export interface Feature { title: string; image: string; tint: boolean }
export interface Category { slug: string; name: string; title: string; description: string }

export const site = siteJson as unknown as {
  origin: string; name: string; tagline: string; email: string; phone: string; phoneHref: string;
  address: { street: string; locality: string; region: string; postalCode: string; country: string };
  addressLine: string;
  social: { facebook: string; linkedin: string };
  copyright: string;
  nav: NavItem[]; footerCompany: NavItem[]; footerTopProducts: string[];
  homeFeatures: Feature[]; slides: Slide[]; homeOrder: string[];
  categories: Category[]; quoteIntro: string; perPage: number;
};

export const products = productsJson as unknown as Product[];
export const pages = pagesJson as unknown as Page[];
export const imageDimensions = dimsJson as Record<string, { width: number; height: number; pipeline: string }>;

const bySlug = new Map(products.map((p) => [p.slug, p]));

export function productBySlug(slug: string): Product {
  const p = bySlug.get(slug);
  if (!p) throw new Error(`unknown product slug: ${slug}`);
  return p;
}

/** Homepage order, as displayed on the live site. */
export const homeProducts: Product[] = site.homeOrder.map(productBySlug);

/** The archive pages sort alphabetically by name, matching WooCommerce's default. */
export const alphabetical: Product[] = [...products].sort((a, b) => a.name.localeCompare(b.name));

export function productsInCategory(slug: string): Product[] {
  return alphabetical.filter((p) => p.category === slug);
}

export function pageBySlug(slug: string): Page {
  const p = pages.find((x) => x.slug === slug);
  if (!p) throw new Error(`unknown page slug: ${slug}`);
  return p;
}

export const categoryBySlug = new Map(site.categories.map((c) => [c.slug, c]));

// ------------------------------------------------------------------ validation
{
  const slugs = new Set<string>();
  const titles = new Map<string, string>();
  const descriptions = new Map<string, string>();
  for (const p of products) {
    if (slugs.has(p.slug)) throw new Error(`duplicate product slug: ${p.slug}`);
    slugs.add(p.slug);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)) throw new Error(`invalid slug: ${p.slug}`);
    if (p.url !== `/product/${p.slug}/`) throw new Error(`bad product url: ${p.url}`);
    if (!p.name || !p.seoTitle || !p.seoDescription) throw new Error(`missing metadata: ${p.slug}`);
    if (!p.images.length) throw new Error(`no images: ${p.slug}`);
    if (!p.faqs.length) throw new Error(`no FAQs: ${p.slug}`);
    const prevT = titles.get(p.seoTitle);
    if (prevT) throw new Error(`duplicate meta title on ${p.slug} and ${prevT}`);
    titles.set(p.seoTitle, p.slug);
    const prevD = descriptions.get(p.seoDescription);
    if (prevD) throw new Error(`duplicate meta description on ${p.slug} and ${prevD}`);
    descriptions.set(p.seoDescription, p.slug);
    for (const r of p.related) {
      if (!bySlug.has(r)) throw new Error(`${p.slug} relates to unknown product ${r}`);
      if (r === p.slug) throw new Error(`${p.slug} relates to itself`);
    }
  }
  if (site.homeOrder.length !== products.length) {
    throw new Error(`homeOrder covers ${site.homeOrder.length} of ${products.length} products`);
  }
}
