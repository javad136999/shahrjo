import Link from 'next/link';
import { absoluteUrl } from '@/lib/site';
import type { BusinessCategoryOption, City, ServiceListingItem } from '@/lib/types';

interface CityServiceDirectoryProps {
  city: City;
  listings: ServiceListingItem[];
  categories: BusinessCategoryOption[];
  activeCategory?: BusinessCategoryOption;
}

export function CityServiceDirectory({ city, listings, categories, activeCategory }: CityServiceDirectoryProps) {
  const path = `/city/${city.slug}/services`;
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: activeCategory ? `${activeCategory.name} در ${city.name}` : `خدمات شهر ${city.name}`,
    itemListElement: listings.map((listing, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Service',
        name: listing.name,
        serviceType: listing.category.name,
        description: listing.description ?? `${listing.category.name} در ${city.name}`,
        areaServed: { '@type': 'City', name: city.name },
        provider: { '@type': 'Person', name: listing.name, telephone: listing.phone },
      },
    })),
  }).replace(/</g, '\\u003c');

  return (
    <main className="city-business-directory" data-testid="city-service-directory">
      <nav className="city-business-directory__breadcrumbs" aria-label="مسیر صفحه">
        <Link href="/">شهرجو</Link><span aria-hidden="true">/</span>
        <Link href={`/city/${city.slug}`}>{city.name}</Link><span aria-hidden="true">/</span>
        <span>دفتر خدمات</span>
      </nav>
      <header className="city-business-directory__header">
        <span className="city-business-directory__eyebrow">دفتر خدمات شهرجو</span>
        <h1>{activeCategory ? `${activeCategory.name}های ${city.name}` : `خدمات و استادکارهای ${city.name}`}</h1>
        <p>
          {activeCategory
            ? `فهرست ${activeCategory.name}های ثبت‌شده در شهر ${city.name}؛ راه تماس و توضیحات ثبت‌شده را ببینید.`
            : `استادکارها و ارائه‌دهندگان خدمات ثبت‌شده در ${city.name} را بر اساس نوع خدمت پیدا کنید.`}
        </p>
        <span className="city-business-directory__city-tag">📍 {city.name}</span>
      </header>
      <nav className="city-business-directory__categories" aria-label="دسته‌بندی خدمات">
        <Link className={!activeCategory ? 'is-active' : ''} href={path}>همهٔ خدمات</Link>
        {categories.map((category) => (
          <Link
            className={activeCategory?.slug === category.slug ? 'is-active' : ''}
            href={`${path}/${encodeURIComponent(category.slug)}`}
            key={category.slug}
          >
            {category.icon ? `${category.icon} ` : ''}{category.name} در {city.name}
          </Link>
        ))}
      </nav>
      {listings.length ? (
        <>
          <p className="city-business-directory__count">{listings.length.toLocaleString('fa-IR')} مورد ثبت‌شده</p>
          <ul className="city-business-directory__list">
            {listings.map((listing) => (
              <li key={listing.id}>
                <article className="city-business-directory__card">
                  <span className="city-business-directory__logo" aria-hidden="true">{listing.category.icon ?? '🧰'}</span>
                  <span className="city-business-directory__copy">
                    <strong>{listing.name}</strong>
                    <span>{listing.category.name} <span aria-hidden="true">·</span> {city.name}</span>
                    {listing.description && <small>{listing.description}</small>}
                  </span>
                  <span className="city-business-directory__tag">📍 {city.name}</span>
                  <a className="city-business-directory__call" href={`tel:${listing.phone}`}>تماس</a>
                </article>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <section className="city-business-directory__empty">
          <h2>{activeCategory ? `هنوز ${activeCategory.name}ی در این شهر ثبت نشده` : 'هنوز موردی ثبت نشده'}</h2>
          <p>اگر ارائه‌دهندهٔ این خدمت هستید، اطلاعات خود را ثبت کنید.</p>
          <Link href={`/city/${city.slug}`}>بازگشت به صفحهٔ شهر</Link>
        </section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </main>
  );
}
