import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the SEO audit's central finding (2026-10-16): the site put two hosts
 * in front of Google — robots.txt, sitemap and Open Graph said shahrjo.ir
 * while the confirmed domain is shahrju.ir — and the city pages carried
 * neither a canonical nor their own title/description. These assertions pin
 * the fix so a later edit cannot quietly reintroduce a second host, re-add
 * sitemap noise Google ignores, or drop the per-page canonical.
 *
 * Assertions run against code with comments stripped: comments are allowed to
 * explain the migration («shahrjo.ir is gone»), only real declarations count.
 */

const read = (...parts: string[]): string => readFileSync(join(__dirname, ...parts), 'utf8');

/**
 * Source with comments removed: block comments and full-line `//` comments.
 * Only full-line `//` is dropped — a naive `//…$` rule would eat the path of
 * `https://shahrju.ir` and hide the very strings we assert on.
 */
const code = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('canonical host (shahrju.ir)', () => {
  it('builds every public URL from one helper, with no second host', () => {
    const site = code(read('..', 'lib', 'site.ts'));
    expect(site).toContain("https://shahrju.ir");
    expect(site).not.toMatch(/shahrjo\.ir/);
    expect(site).toMatch(/NEXT_PUBLIC_SITE_URL \?\? 'https:\/\/shahrju\.ir'/);
  });

  it('root metadata resolves its base against that helper', () => {
    const layout = code(read('layout.tsx'));
    expect(layout).toContain('SITE_URL');
    expect(layout).not.toMatch(/shahrjo\.ir/);
    expect(layout).toMatch(/metadataBase:\s*new URL\(SITE_URL\)/);
  });

  it('robots.txt and the sitemap are served from the same host', () => {
    for (const file of ['robots.ts', 'sitemap.ts']) {
      const source = code(read(file));
      expect(source).toContain('SITE_URL');
      expect(source).not.toMatch(/shahrjo\.ir/);
    }
  });

  it('sitemap drops the fields Google ignores and keeps private routes out', () => {
    const sitemap = code(read('sitemap.ts'));
    expect(sitemap).not.toMatch(/priority\s*:/);
    expect(sitemap).not.toMatch(/changeFrequency\s*:/);
    for (const privatePath of ['/profile', '/messages', '/businesses', '/login']) {
      expect(sitemap).not.toContain(privatePath);
    }
    expect(sitemap).toContain('/city/');
  });

  it('the www host is redirected to the apex by the Next config', () => {
    const config = code(read('..', '..', 'next.config.ts'));
    expect(config).toMatch(/async redirects\(\)/);
    expect(config).toContain('SITE_URL');
    expect(config).toContain('permanent: true');
  });
});

describe('per-page SEO (city pages)', () => {
  it('the city home renders server-side with its own title, description and canonical', () => {
    const page = read('city', '[slug]', 'page.tsx');
    expect(page).not.toContain("'use client'"); // crawlers must get real HTML, not a loader
    expect(page).toMatch(/alternates:\s*{\s*canonical:/);
    expect(page).toContain('generateMetadata');
    expect(page).toContain('آگهی و کسب‌وکارهای شهر');
    expect(page).toContain('absoluteUrl');
  });

  it('the city news page has its own metadata and canonical too', () => {
    const page = read('city', '[slug]', 'news', 'page.tsx');
    expect(page).not.toContain("'use client'");
    expect(page).toMatch(/alternates:\s*{\s*canonical:/);
    expect(page).toContain('generateMetadata');
  });

  it('the landing page exposes the confirmed title and a canonical', () => {
    const page = read('page.tsx');
    expect(page).toMatch(/alternates:\s*{\s*canonical:/);
    expect(page).toContain('آگهی‌ها و کسب‌وکارهای محلی شهرها');
    expect(page).not.toContain("'use client'");
  });

  it('personal screens opt out of the index', () => {
    expect(read('businesses', 'page.tsx')).toMatch(/robots:\s*{\s*index:\s*false/);
    expect(read('profile', 'page.tsx')).toMatch(/robots:\s*{\s*index:\s*false/);
  });
});
