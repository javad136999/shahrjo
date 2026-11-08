import Link from 'next/link';
import { absoluteUrl } from '@/lib/site';
import type { BusinessItem, City } from '@/lib/types';

interface CityBusinessDirectoryProps {
  city: City;
  businesses: BusinessItem[];
  allBusinesses?: BusinessItem[];
  activeCategory?: { slug: string; name: string };
}

export function CityBusinessDirectory({ city, businesses, allBusinesses = businesses, activeCategory }: CityBusinessDirectoryProps) {
  const categories = Array.from(
    new Map(allBusinesses.map((business) => [business.category.slug, business.category])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  const directoryPath = `/city/${city.slug}/businesses`;
  const listItems = businesses.map((business, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'LocalBusiness',
      name: business.name,
      url: absoluteUrl(`/business/${business.id}`),
      ...(business.phone ? { telephone: business.phone } : {}),
      ...(business.logoUrl ? { image: absoluteUrl(business.logoUrl) } : {}),
      address: {
        '@type': 'PostalAddress',
        ...(business.address ? { streetAddress: business.address } : {}),
        addressLocality: city.name,
        addressCountry: 'IR',
      },
      description: `${business.category.name} در ${city.name}`,
    },
  }));
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: activeCategory
      ? `${activeCategory.name} در ${city.name}`
      : `کسب‌وکارهای شهر ${city.name}`,
    itemListElement: listItems,
  }).replace(/</g, '\\u003c');

  return (
    <main className="city-business-directory" data-testid="city-business-directory">
      <nav className="city-business-directory__breadcrumbs" aria-label="مسیر صفحه">
        <Link href="/">شهرجو</Link><span aria-hidden="true">/</span>
        <Link href={`/city/${city.slug}`}>{city.name}</Link><span aria-hidden="true">/</span>
        <span>کسب‌وکارها</span>
      </nav>
      <header className="city-business-directory__header">
        <span className="city-business-directory__eyebrow">فهرست محلی شهرجو</span>
        <h1>{activeCategory ? `${activeCategory.name} در ${city.name}` : `کسب‌وکارهای ${city.name}`}</h1>
        <p>
          {activeCategory
            ? `فهرست کسب‌وکارهای دستهٔ ${activeCategory.name} در شهر ${city.name}؛ همراه با نشانی و راه‌های تماس ثبت‌شده.`
            : `کسب‌وکارهای تأییدشدهٔ شهر ${city.name} را بر اساس دسته‌بندی پیدا کنید و اطلاعات تماس و نشانی ثبت‌شده را ببینید.`}
        </p>
        <span className="city-business-directory__city-tag" aria-label={`شهر ${city.name}`}>📍 {city.name}</span>
      </header>

      <nav className="city-business-directory__categories" aria-label="دسته‌بندی کسب‌وکارها">
        <Link className={!activeCategory ? 'is-active' : ''} href={directoryPath}>همهٔ کسب‌وکارها</Link>
        {categories.map((category) => (
          <Link
            className={activeCategory?.slug === category.slug ? 'is-active' : ''}
            href={`${directoryPath}/${encodeURIComponent(category.slug)}`}
            key={category.slug}
          >
            {category.icon ? `${category.icon} ` : ''}{category.name} در {city.name}
          </Link>
        ))}
      </nav>

      {businesses.length ? (
        <>
          <p className="city-business-directory__count">{businesses.length.toLocaleString('fa-IR')} کسب‌وکار ثبت‌شده</p>
          <ul className="city-business-directory__list">
            {businesses.map((business) => (
              <li key={business.id}>
                <article className="city-business-directory__card">
                  <Link className="city-business-directory__main" href={`/business/${business.id}`}>
                    <span className="city-business-directory__logo" aria-hidden="true">
                      {business.logoUrl
                        // eslint-disable-next-line @next/next/no-img-element -- public logo URL
                        ? <img src={business.logoUrl} alt="" loading="lazy" />
                        : business.category.icon ?? '🏪'}
                    </span>
                    <span className="city-business-directory__copy">
                      <strong>{business.name}</strong>
                      <span>{business.category.name} <span aria-hidden="true">·</span> {city.name}</span>
                      {business.address && <small>{business.address}</small>}
                    </span>
                  </Link>
                  <span className="city-business-directory__tag">📍 {city.name}</span>
                  {business.phone && <a className="city-business-directory__call" href={`tel:${business.phone}`}>تماس</a>}
                </article>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <section className="city-business-directory__empty">
          <h2>{activeCategory ? `هنوز کسب‌وکاری در دستهٔ ${activeCategory.name} ثبت نشده` : 'هنوز کسب‌وکاری ثبت نشده'}</h2>
          <p>می‌توانید کسب‌وکار خود را در شهر {city.name} معرفی کنید.</p>
          <Link href="/business/new">ثبت کسب‌وکار</Link>
        </section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </main>
  );
}
