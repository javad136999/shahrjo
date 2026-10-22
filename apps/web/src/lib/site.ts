/**
 * Canonical host of the public site — the one value every crawler-facing URL
 * is built from (metadataBase, rel=canonical, og:url, robots.txt, sitemap).
 *
 * Confirmed target domain: https://shahrju.ir (SEO audit, 2026-10-16). The
 * previous default, shahrjo.ir, is gone: sitemap, robots and Open Graph all
 * pointed at that host, which put two domains in front of Google for the same
 * pages. `NEXT_PUBLIC_SITE_URL` still overrides it for previews/staging.
 */
const configured = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shahrju.ir';

/** Site origin without a trailing slash: `https://shahrju.ir`. */
export const SITE_URL = configured.replace(/\/+$/, '');

/** Absolute canonical URL for a site path (`/city/jam` → `https://shahrju.ir/city/jam`). */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Open Graph block for a page-level `metadata` export.
 *
 * Next merges metadata by *top-level key*: a page that declares its own
 * `openGraph` replaces the layout's object outright, which silently dropped
 * the share image (og:image then went missing on the pages that set their own
 * title). Every page should therefore build its block through this helper, so
 * the image, locale and site name stay attached and the image URL resolves
 * against SITE_URL.
 */
export function openGraphFor(input: {
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
}) {
  const image = input.imageUrl
    ? { url: input.imageUrl, width: 640, height: 420, alt: input.title }
    : { url: '/icon-512x512.png?v=2', width: 512, height: 512, alt: 'لوگوی شهرجو' };
  return {
    type: 'website' as const,
    locale: 'fa_IR',
    siteName: 'شهرجو',
    url: input.url,
    title: input.title,
    description: input.description,
    images: [image],
  };
}
