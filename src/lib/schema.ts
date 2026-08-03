/**
 * JSON-LD builders.
 *
 * Only facts that exist in the legitimate exports are emitted. In particular the
 * old site's Product schema carried an aggregateRating of 5 from a single
 * "review" written by the site administrator and reusing the meta description as
 * its body. That is fabricated review data, so it is deliberately not carried
 * over — see MIGRATION_CONFLICTS.md.
 */
import { site, type Product, type Faq } from './site';

export function organization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${site.origin}/#organization`,
    name: site.name,
    url: `${site.origin}/`,
    logo: `${site.origin}/images/site/Inserts-Hub-logo.png`,
    email: site.email,
    telephone: site.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.locality,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    sameAs: [site.social.facebook, site.social.linkedin],
  };
}

export function website() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site.origin}/#website`,
    url: `${site.origin}/`,
    name: site.name,
    publisher: { '@id': `${site.origin}/#organization` },
    inLanguage: 'en-US',
  };
}

export function breadcrumbs(items: Array<{ label: string; href?: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${site.origin}${item.href}` } : {}),
    })),
  };
}

export function product(p: Product, imageUrls: string[]) {
  const url = `${site.origin}${p.url}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    url,
    name: p.name,
    description: p.seoDescription,
    sku: p.id,
    mpn: p.id,
    category: p.categoryName,
    brand: { '@type': 'Brand', name: site.name },
    image: imageUrls.map((u) => new URL(u, site.origin).href),
    offers: {
      '@type': 'Offer',
      url,
      price: p.price,
      priceCurrency: 'USD',
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@id': `${site.origin}/#organization` },
    },
  };
}

/** The `name`/`text` values must be byte-identical to what the accordion renders. */
export function faqPage(faqs: Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answerText },
    })),
  };
}

export function contactPage(path: string, name: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    '@id': `${site.origin}${path}#contactpage`,
    url: `${site.origin}${path}`,
    name,
    mainEntity: { '@id': `${site.origin}/#organization` },
  };
}

export function collectionPage(path: string, name: string, description: string, items: Product[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${site.origin}${path}#collection`,
    url: `${site.origin}${path}`,
    name,
    ...(description ? { description } : {}),
    isPartOf: { '@id': `${site.origin}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: p.name,
        url: `${site.origin}${p.url}`,
      })),
    },
  };
}
