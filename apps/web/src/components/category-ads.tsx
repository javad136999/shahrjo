'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdCategories, getCityAds, getLocalCity } from '@/lib/api';
import { formatPrice, thumbFallback, thumbUrlFor } from '@/lib/format';
import type { AdCategoryOption, AdItem, LocalCity } from '@/lib/types';

export interface CategoryAdsProps {
  category?: string;
}

/**
 * فهرست آگهی‌های یک دسته برای شهر انتخاب‌شده — مقصد میانبرهای دسته‌بندی
 * در بالای چت روم. آگهی‌ها همچنان در خود چت شهر هم نمایش داده می‌شوند؛
 * این صفحه فقط نمای فیلترشده و سریع‌تر همان آگهی‌هاست.
 */
export function CategoryAds({ category }: CategoryAdsProps) {
  const [city, setCity] = useState<LocalCity | null | undefined>(undefined);
  const [cats, setCats] = useState<AdCategoryOption[]>([]);
  const [ads, setAds] = useState<AdItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCity(getLocalCity());
    getAdCategories()
      .then((all) => setCats(all.slice(0, 6)))
      .catch(() => setCats([]));
  }, []);

  useEffect(() => {
    if (!city) return;
    let alive = true;
    setAds(null);
    setError(null);
    getCityAds(city.slug, 40, category)
      .then((rows) => {
        if (alive) setAds(rows);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'دریافت آگهی‌ها ناموفق بود');
      });
    return () => {
      alive = false;
    };
  }, [city, category]);

  if (city === undefined) {
    return (
      <p className="muted loading" aria-busy>
        در حال بارگذاری…
      </p>
    );
  }

  if (city === null) {
    return (
      <div className="banner banner--error" role="alert">
        <span>برای دیدن آگهی‌ها ابتدا شهر خود را انتخاب کنید.</span>
        <Link href="/" className="btn btn-ghost">
          انتخاب شهر
        </Link>
      </div>
    );
  }

  const active = cats.find((c) => c.slug === category) ?? null;

  return (
    <div className="catad" data-testid="category-ads">
      <header className="catad__head">
        <div className="catad__copy">
          <small className="muted">{city.name}</small>
          <h1>{active ? `آگهی‌های ${active.name}` : 'آگهی‌های شهر'}</h1>
        </div>
        <Link href="/wall" className="pill" data-testid="catad-back">
          💬 چت شهر
        </Link>
      </header>

      <nav className="wall-cats wall-cats--page" aria-label="دسته‌بندی آگهی‌ها">
        <Link href="/ads" className={`wall-cat${!category ? ' is-active' : ''}`} data-testid="catad-cat-all">
          <span aria-hidden>✨</span>
          <small>همه</small>
        </Link>
        {cats.map((c) => (
          <Link
            key={c.slug}
            href={`/ads?category=${encodeURIComponent(c.slug)}`}
            className={`wall-cat${category === c.slug ? ' is-active' : ''}`}
            data-testid={`catad-cat-${c.slug}`}
          >
            <span aria-hidden>{c.icon ?? '◆'}</span>
            <small>{c.name}</small>
          </Link>
        ))}
      </nav>

      {error && (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <div className="catad-grid" data-testid="catad-grid">
        {ads === null ? (
          <p className="muted loading" aria-busy>
            در حال بارگذاری آگهی‌ها…
          </p>
        ) : ads.length === 0 ? (
          <p className="empty-state">فعلاً آگهی تأییدشده‌ای در این دسته برای {city.name} نیست.</p>
        ) : (
          ads.map((a) => (
            <Link key={a.id} href={`/ad/${a.id}`} className="catad-card" data-testid={`catad-card-${a.id}`}>
              {a.coverUrl ? (
                <img
                  className="catad-card__img"
                  src={thumbUrlFor(a.coverUrl) ?? a.coverUrl}
                  alt=""
                  loading="lazy"
                  onError={thumbFallback(a.coverUrl)}
                />
              ) : (
                <span className="catad-card__noimg" aria-hidden>
                  {a.category.icon ?? '◆'}
                </span>
              )}
              <strong className="catad-card__title">{a.title}</strong>
              <span className="catad-card__cat">
                {a.category.icon ?? '◆'} {a.category.name}
              </span>
              <b className="catad-card__price">{a.price !== null ? formatPrice(a.price) : 'توافقی'}</b>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
