'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getAdCategories, getCityAds } from '@/lib/api';
import { formatPrice, thumbFallback, thumbUrlFor } from '@/lib/format';
import type { AdCategoryOption, AdItem } from '@/lib/types';

export interface CityClassifiedsProps {
  city: { id: number; slug: string; name: string };
}

type SortMode = 'newest' | 'oldest' | 'price-low' | 'price-high';

/**
 * دیوار شهر — بازار آگهی محلی، نه اتاق گفتگو.
 * همه داده‌ها از فهرست عمومی آگهی‌های همان شهر می‌آیند و کارت‌ها به جزئیات آگهی لینک می‌شوند.
 */
export function CityClassifieds({ city }: CityClassifiedsProps) {
  const [categories, setCategories] = useState<AdCategoryOption[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [ads, setAds] = useState<AdItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getAdCategories().then((items) => {
      if (alive) setCategories(items);
    }).catch(() => {
      if (alive) setCategories([]);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setAds(null);
    setError(null);
    getCityAds(city.slug, 100, selectedCategory || undefined)
      .then((items) => {
        if (alive) setAds(items);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'دریافت آگهی‌ها ناموفق بود');
      });
    return () => {
      alive = false;
    };
  }, [city.slug, selectedCategory]);

  const visibleAds = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = (ads ?? []).filter((ad) => {
      if (!normalized) return true;
      return `${ad.title} ${ad.category.name}`.toLocaleLowerCase().includes(normalized);
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'oldest') return new Date(a.publishedAt ?? 0).getTime() - new Date(b.publishedAt ?? 0).getTime();
      if (sort === 'price-low') return (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER);
      if (sort === 'price-high') return (b.price ?? -1) - (a.price ?? -1);
      return new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime();
    });
  }, [ads, query, sort]);

  const activeCategory = categories.find((category) => category.slug === selectedCategory);

  return (
    <main className="classifieds" data-testid="city-classifieds">
      <section className="classifieds__hero">
        <div>
          <span className="classifieds__eyebrow">بازار محلی شهر</span>
          <h1>دیوار {city.name}</h1>
          <p>آگهی‌های خرید، فروش و خدمات مردم {city.name} را یکجا ببینید.</p>
        </div>
        <Link href="/ads/new" className="classifieds__post-btn" data-testid="classifieds-new-ad">
          <span aria-hidden>＋</span>
          ثبت آگهی
        </Link>
      </section>

      <section className="classifieds__search" aria-label="جست‌وجو و فیلتر آگهی‌ها">
        <label className="classifieds__searchbox">
          <span aria-hidden>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجو در آگهی‌های شهر…"
            aria-label="جست‌وجو در آگهی‌ها"
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="پاک کردن جست‌وجو">×</button>}
        </label>
        <label className="classifieds__sort">
          <span>مرتب‌سازی</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label="مرتب‌سازی آگهی‌ها">
            <option value="newest">جدیدترین</option>
            <option value="oldest">قدیمی‌ترین</option>
            <option value="price-low">ارزان‌ترین</option>
            <option value="price-high">گران‌ترین</option>
          </select>
        </label>
      </section>

      <section className="classifieds__categories" aria-label="دسته‌بندی آگهی‌ها">
        <button type="button" className={!selectedCategory ? 'is-active' : ''} onClick={() => setSelectedCategory('')}>
          <span aria-hidden>✨</span><b>همه آگهی‌ها</b>
        </button>
        {categories.map((category) => (
          <button
            type="button"
            key={category.slug}
            className={selectedCategory === category.slug ? 'is-active' : ''}
            onClick={() => setSelectedCategory(category.slug)}
          >
            <span aria-hidden>{category.icon ?? '◆'}</span>
            <b>{category.name}</b>
          </button>
        ))}
      </section>

      <div className="classifieds__toolbar">
        <div>
          <strong>{activeCategory ? `آگهی‌های ${activeCategory.name}` : 'همه آگهی‌های شهر'}</strong>
          {ads && <span>{visibleAds.length.toLocaleString('fa-IR')} آگهی</span>}
        </div>
        <Link href="/businesses" className="classifieds__business-link">کسب‌وکارهای شهر ←</Link>
      </div>

      {error && <div className="banner banner--error" role="alert">{error}</div>}

      {ads === null ? (
        <div className="classifieds__loading" aria-busy="true">در حال دریافت آگهی‌های {city.name}…</div>
      ) : visibleAds.length === 0 ? (
        <section className="classifieds__empty" data-testid="classifieds-empty">
          <span aria-hidden>{activeCategory?.icon ?? '📭'}</span>
          <div>
            <h2>{query ? 'آگهی‌ای با این عبارت پیدا نشد' : 'هنوز آگهی‌ای در این بخش ثبت نشده'}</h2>
            <p>{query ? 'عبارت دیگری را امتحان کنید یا فیلتر دسته‌بندی را بردارید.' : 'اولین نفر باشید که آگهی خود را در این شهر منتشر می‌کند.'}</p>
          </div>
          <Link href="/ads/new" className="btn btn-primary">ثبت اولین آگهی</Link>
        </section>
      ) : (
        <section className="classifieds__grid" data-testid="classifieds-grid">
          {visibleAds.map((ad) => (
            <Link href={`/ad/${ad.id}`} className="classified-card" key={ad.id} data-testid={`classified-card-${ad.id}`}>
              <div className="classified-card__media">
                {ad.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- API media URL
                  <img src={thumbUrlFor(ad.coverUrl) ?? ad.coverUrl} alt="" loading="lazy" onError={thumbFallback(ad.coverUrl)} />
                ) : (
                  <span aria-hidden>{ad.category.icon ?? '◆'}</span>
                )}
                <span className="classified-card__category">{ad.category.icon ?? '◆'} {ad.category.name}</span>
              </div>
              <div className="classified-card__body">
                <h2>{ad.title}</h2>
                <p>{ad.viewCount.toLocaleString('fa-IR')} بازدید · آگهی فعال در {city.name}</p>
                <strong>{ad.price !== null ? formatPrice(ad.price) : 'توافقی'}</strong>
                <small>{city.name} · مشاهده جزئیات آگهی ←</small>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
