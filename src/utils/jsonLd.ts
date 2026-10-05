/**
 * schema.org builders shared by the page templates.
 *
 * Everything here ends up inside a <script type="application/ld+json"> block, so
 * it must go through serializeJsonLd(): JSON.stringify does not escape "<", and a
 * crawled job description containing "</script>" would close the block early and
 * leave the rest of the posting on the page as live markup.
 */

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

const SITE_NAME = '远程岛';

function origin(siteUrl: string): string {
  return siteUrl.replace(/\/$/, '');
}

/**
 * BreadcrumbList for the trail already rendered by breadcrumb(). Needs absolute
 * URLs, so it is skipped when the template has no SITE_URL to build them from —
 * a relative `item` is not reliably resolved by crawlers.
 */
export function breadcrumbJsonLd(items: BreadcrumbItem[], siteUrl?: string): string {
  if (!siteUrl) return '';
  const base = origin(siteUrl);
  const named = items.filter((item) => item.label.trim());
  // A single crumb is just the page itself; Google ignores those.
  if (named.length < 2) return '';

  return serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: named.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${base}${item.href}` } : {}),
    })),
  });
}

/** Homepage-only: the sitelinks search box plus the publisher entity. */
export function siteJsonLd(siteUrl?: string): string {
  if (!siteUrl) return '';
  const base = origin(siteUrl);

  return serializeJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: 'yuanchengdao',
      url: `${base}/`,
      inLanguage: 'zh-CN',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${base}/?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: `${base}/`,
      logo: `${base}/yuanchengdao-logo.png`,
      description: '面向华人的全球远程工作平台，每天更新来自世界各地的远程岗位。',
    },
  ]);
}

/**
 * The job URLs a landing page lists, in display order. Kept to position + url:
 * the full posting lives on its own page and is marked up there, and repeating
 * it here would be duplicate markup on every paginated view.
 */
export function jobItemListJsonLd(
  slugs: Array<string | null | undefined>,
  siteUrl?: string,
  offset = 0,
): string {
  if (!siteUrl) return '';
  const base = origin(siteUrl);
  const present = slugs.filter((slug): slug is string => !!slug);
  if (present.length === 0) return '';

  return serializeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: present.length,
    itemListElement: present.map((slug, index) => ({
      '@type': 'ListItem',
      position: offset + index + 1,
      url: `${base}/job/${encodeURIComponent(slug)}`,
    })),
  });
}
