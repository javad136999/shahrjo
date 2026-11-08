'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getAdCategories, getCityAdNeighborhoods, getCityAds, getShowcase } from '@/lib/api';
import { formatPrice, thumbFallback, thumbUrlFor } from '@/lib/format';
import type { AdCategoryOption, AdItem, ShowcaseItem } from '@/lib/types';

export interface CityClassifiedsProps {
  city: { id: number; slug: string; name: string };
}

type SortMode = 'newest' | 'oldest' | 'price-low' | 'price-high';

function dailyBusiness(items: ShowcaseItem[], citySlug: string): ShowcaseItem | null {
  const eligibleBusinesses = items.filter((item) => item.subscriptionTier === 'GOLD');
  if (!eligibleBusinesses.length) return null;
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const cityHash = [...citySlug].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
  const dayNumber = Number(day.replace(/-/g, ''));
  return eligibleBusinesses[(cityHash + dayNumber) % eligibleBusinesses.length];
}

/**
 * دیوار شهر — بازار آگهی محلی، نه اتاق گفتگو.
 * همه داده‌ها از فهرست عمومی آگهی‌های همان شهر می‌آیند و کارت‌ها به جزئیات آگهی لینک می‌شوند.
 */
export function CityClassifieds({ city }: CityClassifiedsProps) {
  const [categories, setCategories] = useState<AdCategoryOption[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [draftMinPrice, setDraftMinPrice] = useState('');
  const [draftMaxPrice, setDraftMaxPrice] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [ads, setAds] = useState<AdItem[] | null>(null);
  const [dailyPromo, setDailyPromo] = useState<ShowcaseItem | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getShowcase(city.slug, 100)
      .then((items) => { if (alive) setDailyPromo(dailyBusiness(items, city.slug)); })
      .catch(() => { if (alive) setDailyPromo(null); });
    return () => { alive = false; };
  }, [city.slug]);

  useEffect(() => {
    let alive = true;
    // Keep the route resilient to lightweight host mocks that only provide city APIs.
    if (typeof getAdCategories !== 'function') {
      setCategories([]);
      return () => {
        alive = false;
      };
    }
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
    if (typeof getCityAdNeighborhoods !== 'function') {
      setNeighborhoods([]);
      return () => { alive = false; };
    }
    getCityAdNeighborhoods(city.slug).then((items) => {
      if (alive) setNeighborhoods(items);
    }).catch(() => {
      if (alive) setNeighborhoods([]);
    });
    return () => { alive = false; };
  }, [city.slug]);

  useEffect(() => {
    let alive = true;
    setAds(null);
    setError(null);
    const min = minPrice.trim() ? Number(minPrice.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[,٬\s]/g, '')) : undefined;
    const max = maxPrice.trim() ? Number(maxPrice.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[,٬\s]/g, '')) : undefined;
    getCityAds(city.slug, 100, selectedCategory || undefined, selectedNeighborhood || undefined, Number.isFinite(min) ? min : undefined, Number.isFinite(max) ? max : undefined)
      .then((items) => {
        if (alive) setAds(items);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'دریافت آگهی‌ها ناموفق بود');
      });
    return () => {
      alive = false;
    };
  }, [city.slug, selectedCategory, selectedNeighborhood, minPrice, maxPrice]);

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
  const filteredCategories = categories.filter((category) =>
    `${category.name} ${category.slug}`.toLocaleLowerCase().includes(categoryQuery.trim().toLocaleLowerCase()),
  );
  const activeFilterCount = [selectedCategory, selectedNeighborhood, minPrice, maxPrice].filter(Boolean).length;
  const applyAdvancedFilters = () => {
    setMinPrice(draftMinPrice);
    setMaxPrice(draftMaxPrice);
    setAdvancedOpen(false);
  };
  const clearFilters = () => {
    setSelectedCategory('');
    setSelectedNeighborhood('');
    setMinPrice('');
    setMaxPrice('');
    setDraftMinPrice('');
    setDraftMaxPrice('');
    setCategoryQuery('');
  };
  const removeFilter = (type: 'category' | 'neighborhood' | 'min' | 'max') => {
    if (type === 'category') setSelectedCategory('');
    if (type === 'neighborhood') setSelectedNeighborhood('');
    if (type === 'min') { setMinPrice(''); setDraftMinPrice(''); }
    if (type === 'max') { setMaxPrice(''); setDraftMaxPrice(''); }
  };

  return (
    <main className="classifieds" data-testid="city-classifieds">
      <section className="classifieds__hero">
        <div>
          <span className="classifieds__eyebrow">بازار محلی شهر</span>
          <h1>دیوار {city.name}</h1>
          <p>آگهی‌های خرید، فروش و خدمات مردم {city.name} را راحت پیدا کنید.</p>
        </div>
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
        <button type="button" className={`classifieds__advanced-toggle ${advancedOpen ? 'is-active' : ''}`} onClick={() => {
          setDraftMinPrice(minPrice);
          setDraftMaxPrice(maxPrice);
          setAdvancedOpen((open) => !open);
        }}>
          ☷ فیلترها {activeFilterCount > 0 && <b>{activeFilterCount.toLocaleString('fa-IR')}</b>}
        </button>
      </section>

      {advancedOpen && (
        <section className="classifieds__advanced" aria-label="فیلترهای پیشرفته آگهی">
          <div className="classifieds__filter-field">
            <label htmlFor="classified-neighborhood">محله</label>
            <select id="classified-neighborhood" value={selectedNeighborhood} onChange={(event) => setSelectedNeighborhood(event.target.value)}>
              <option value="">همه محله‌های شهر</option>
              {neighborhoods.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </div>
          <div className="classifieds__filter-field">
            <label htmlFor="classified-min-price">حداقل قیمت (ریال)</label>
            <input id="classified-min-price" inputMode="numeric" value={draftMinPrice} onChange={(event) => setDraftMinPrice(event.target.value)} placeholder="مثلاً ۱۰۰٬۰۰۰" />
          </div>
          <div className="classifieds__filter-field">
            <label htmlFor="classified-max-price">حداکثر قیمت (ریال)</label>
            <input id="classified-max-price" inputMode="numeric" value={draftMaxPrice} onChange={(event) => setDraftMaxPrice(event.target.value)} placeholder="مثلاً ۵۰۰٬۰۰۰" />
          </div>
          <div className="classifieds__advanced-actions">
            <button type="button" className="classifieds__apply-filters" onClick={applyAdvancedFilters}>نمایش آگهی‌ها</button>
            {activeFilterCount > 0 && <button type="button" className="classifieds__clear-filters" onClick={clearFilters}>پاک کردن همه</button>}
          </div>
        </section>
      )}

      <section className="classifieds__category-panel" aria-label="دسته‌بندی آگهی‌ها">
        <div className="classifieds__category-head">
          <div><strong>دسته‌بندی آگهی‌ها</strong><small>دسته موردنظر را انتخاب کنید</small></div>
          {categories.length > 5 && <label className="classifieds__category-search"><span aria-hidden>⌕</span><input value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder="جست‌وجوی دسته…" aria-label="جست‌وجوی دسته‌بندی" /></label>}
        </div>
        <div className="classifieds__categories">
        <button type="button" className={!selectedCategory ? 'is-active' : ''} onClick={() => setSelectedCategory('')}>
          <span aria-hidden>✨</span><b>همه</b>
        </button>
        {filteredCategories.map((category) => (
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
        {filteredCategories.length === 0 && <span className="classifieds__no-category">دسته‌ای پیدا نشد</span>}
        </div>
      </section>

      {activeFilterCount > 0 && <div className="classifieds__active-filters" aria-label="فیلترهای فعال">
        <span>فیلترهای فعال:</span>
        {activeCategory && <button type="button" onClick={() => removeFilter('category')}>{activeCategory.name} ×</button>}
        {selectedNeighborhood && <button type="button" onClick={() => removeFilter('neighborhood')}>{selectedNeighborhood} ×</button>}
        {minPrice && <button type="button" onClick={() => removeFilter('min')}>از {minPrice} ×</button>}
        {maxPrice && <button type="button" onClick={() => removeFilter('max')}>تا {maxPrice} ×</button>}
        <button type="button" className="classifieds__active-clear" onClick={clearFilters}>حذف همه</button>
      </div>}

      <div className="classifieds__toolbar">
        <div>
          <strong>{activeCategory ? `آگهی‌های ${activeCategory.name}` : 'همه آگهی‌های شهر'}</strong>
          {ads && <span>{visibleAds.length.toLocaleString('fa-IR')} آگهی</span>}
        </div>
        <Link href="/businesses" className="classifieds__business-link">کسب‌وکارهای شهر ←</Link>
      </div>

      {dailyPromo && (
        <Link
          href={`/business/${dailyPromo.id}`}
          className="classifieds__daily-promo"
          data-testid="classifieds-daily-promo"
          aria-label={`تبلیغ امروز: ${dailyPromo.name}، ${dailyPromo.category.name}`}
        >
          <span className="classifieds__daily-promo-icon" aria-hidden="true">
            {dailyPromo.category.icon ?? '🏪'}
          </span>
          <span className="classifieds__daily-promo-copy">
            <small><b>تبلیغ امروز</b><span>از کسب‌وکارهای شهر {city.name}</span></small>
            <strong>{dailyPromo.name}</strong>
            <span>{dailyPromo.category.name}{dailyPromo.address ? ` · ${dailyPromo.address}` : ''}</span>
          </span>
          <span className="classifieds__daily-promo-cta">مشاهده <span aria-hidden="true">←</span></span>
        </Link>
      )}

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
                <small>{ad.neighborhood ? `${ad.neighborhood} · ` : ''}{city.name} · مشاهده جزئیات آگهی ←</small>
              </div>
            </Link>
          ))}
        </section>
      )}

      <Link
        href="/ads/new"
        className="classifieds__floating-post-btn"
        data-testid="classifieds-new-ad"
        aria-label="ثبت آگهی جدید در دیوار شهر"
        title="ثبت آگهی جدید"
      >
        <span aria-hidden="true">＋</span>
        <strong>ثبت آگهی</strong>
      </Link>
    </main>
  );
}
