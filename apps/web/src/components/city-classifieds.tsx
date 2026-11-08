'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { deleteAdminAd, getAdCategories, getCityAdNeighborhoods, getCityAds, getCityBusinesses, getCityServiceWallPromos, getProfile, getShowcase, getTokens } from '@/lib/api';
import { formatPrice, thumbFallback, thumbUrlFor } from '@/lib/format';
import type { AdCategoryOption, AdItem, BusinessItem, ServiceListingWallPromo, ServiceListingWallPromos, ShowcaseItem } from '@/lib/types';

export interface CityClassifiedsProps {
  city: { id: number; slug: string; name: string };
}

type SortMode = 'newest' | 'oldest' | 'price-low' | 'price-high';

function dailyChoice<T>(items: T[], citySlug: string): T | null {
  if (!items.length) return null;
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const cityHash = [...citySlug].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
  const dayNumber = Number(day.replace(/-/g, ''));
  return items[(cityHash + dayNumber) % items.length];
}

function dailyBusiness(items: BusinessItem[], citySlug: string): BusinessItem | null {
  return dailyChoice(items.filter((item) => item.subscriptionTier === 'FREE'), citySlug);
}

function dailyGoldPromo(items: ShowcaseItem[], citySlug: string): ShowcaseItem | null {
  return dailyChoice(items.filter((item) => item.subscriptionTier === 'GOLD'), citySlug);
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [ads, setAds] = useState<AdItem[] | null>(null);
  const [dailyBusinessAd, setDailyBusinessAd] = useState<BusinessItem | null>(null);
  const [dailyPromo, setDailyPromo] = useState<ShowcaseItem | null>(null);
  const [serviceWallPromos, setServiceWallPromos] = useState<ServiceListingWallPromos | null>(null);
  const [servicePromosError, setServicePromosError] = useState(false);
  const [businessesLoaded, setBusinessesLoaded] = useState(false);
  const [canManageAds, setCanManageAds] = useState(false);
  const [refreshAds, setRefreshAds] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!getTokens()) {
      setCanManageAds(false);
      return () => { alive = false; };
    }
    getProfile().then((profile) => {
      if (alive) setCanManageAds(profile.roles.some((role) => ['SUPER_ADMIN', 'PROVINCE_ADMIN', 'CITY_ADMIN', 'MODERATOR'].includes(role)));
    }).catch(() => {
      if (alive) setCanManageAds(false);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setBusinessesLoaded(false);
    getCityBusinesses(city.slug, 200)
      .then((items) => {
        if (alive) {
          setDailyBusinessAd(dailyBusiness(items, city.slug));
          setBusinessesLoaded(true);
        }
      })
      .catch(() => {
        if (alive) {
          setDailyBusinessAd(null);
          setBusinessesLoaded(true);
        }
      });
    return () => { alive = false; };
  }, [city.slug]);

  useEffect(() => {
    let alive = true;
    getShowcase(city.slug, 100)
      .then((items) => { if (alive) setDailyPromo(dailyGoldPromo(items, city.slug)); })
      .catch(() => { if (alive) setDailyPromo(null); });
    return () => { alive = false; };
  }, [city.slug]);

  useEffect(() => {
    let alive = true;
    setServiceWallPromos(null);
    setServicePromosError(false);
    getCityServiceWallPromos(city.slug)
      .then((promos) => { if (alive) setServiceWallPromos(promos); })
      .catch(() => { if (alive) setServicePromosError(true); });
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
  }, [city.slug, selectedCategory, selectedNeighborhood, minPrice, maxPrice, refreshAds]);

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

  const visibleDailyBusiness = useMemo(() => {
    if (!dailyBusinessAd) return null;
    const normalized = query.trim().toLocaleLowerCase();
    const searchable = `${dailyBusinessAd.name} ${dailyBusinessAd.category.name} ${dailyBusinessAd.address ?? ''}`.toLocaleLowerCase();
    if (normalized && !searchable.includes(normalized)) return null;
    if (selectedCategory && dailyBusinessAd.category.slug !== selectedCategory) return null;
    if (selectedNeighborhood && !(dailyBusinessAd.address ?? '').includes(selectedNeighborhood)) return null;
    if (minPrice || maxPrice) return null;
    return dailyBusinessAd;
  }, [dailyBusinessAd, query, selectedCategory, selectedNeighborhood, minPrice, maxPrice]);

  const visibleServicePromos = useMemo(() => {
    if (!serviceWallPromos || (selectedCategory && selectedCategory !== 'services') || selectedNeighborhood || minPrice || maxPrice) return [];
    const normalized = query.trim().toLocaleLowerCase();
    const filtered = serviceWallPromos.listings.filter(({ listing }) =>
      !normalized || `${listing.name} ${listing.category.name} ${listing.description ?? ''} ${listing.phone}`.toLocaleLowerCase().includes(normalized),
    );
    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sort === 'oldest' ? aTime - bTime : bTime - aTime;
    });
  }, [serviceWallPromos, selectedCategory, selectedNeighborhood, minPrice, maxPrice, query, sort]);

  const visibleDailyServicePromo = useMemo<ServiceListingWallPromo | null>(() => {
    const daily = serviceWallPromos?.daily;
    if (!daily || (selectedCategory && selectedCategory !== 'services') || selectedNeighborhood || minPrice || maxPrice) return null;
    const normalized = query.trim().toLocaleLowerCase();
    const searchable = `${daily.listing.name} ${daily.listing.category.name} ${daily.listing.description ?? ''} ${daily.listing.phone}`.toLocaleLowerCase();
    return normalized && !searchable.includes(normalized) ? null : daily;
  }, [serviceWallPromos, selectedCategory, selectedNeighborhood, minPrice, maxPrice, query]);

  const activeCategory = categories.find((category) => category.slug === selectedCategory);
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
  };
  const removeFilter = (type: 'category' | 'neighborhood' | 'min' | 'max') => {
    if (type === 'category') setSelectedCategory('');
    if (type === 'neighborhood') setSelectedNeighborhood('');
    if (type === 'min') { setMinPrice(''); setDraftMinPrice(''); }
    if (type === 'max') { setMaxPrice(''); setDraftMaxPrice(''); }
  };

  const removeAd = async (ad: AdItem) => {
    if (!window.confirm(`آگهی «${ad.title}» حذف شود؟ از دیوار و فهرست آگهی‌ها برداشته می‌شود.`)) return;
    setError(null);
    try {
      await deleteAdminAd(ad.id);
      setRefreshAds((version) => version + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حذف آگهی ناموفق بود');
    }
  };

  return (
    <main className="classifieds" data-testid="city-classifieds">
      <section className="classifieds__search">
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
      </section>

      <section className="classifieds__category-panel" aria-label="دسته‌بندی آگهی‌ها">
        <div className="classifieds__category-head">
          <strong>دسته‌بندی آگهی‌ها</strong>
        </div>
        <div className="classifieds__categories">
          <button type="button" className={!selectedCategory ? 'is-active' : ''} onClick={() => setSelectedCategory('')}>
            <span aria-hidden>✨</span><b>همه</b>
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
          {ads && serviceWallPromos && <span>{(visibleAds.length + (visibleDailyBusiness ? 1 : 0) + visibleServicePromos.length).toLocaleString('fa-IR')} آگهی</span>}
          {serviceWallPromos && (
            <span
              className={`classifieds__service-post-count${serviceWallPromos.missingCount > 0 ? ' classifieds__service-post-count--incomplete' : ''}`}
              data-testid="service-promo-status"
            >
              {serviceWallPromos.publishedCount.toLocaleString('fa-IR')} از {serviceWallPromos.activeCount.toLocaleString('fa-IR')} شغل در دیوار
            </span>
          )}
        </div>
        <div className="classifieds__toolbar-actions">
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
          <Link href="/businesses" className="classifieds__business-link">کسب‌وکارهای شهر ←</Link>
        </div>
      </div>

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

      {visibleDailyServicePromo && (
        <Link
          href={`/city/${city.slug}/services/${visibleDailyServicePromo.listing.category.slug}`}
          className="classifieds__daily-promo classifieds__daily-promo--service"
          data-testid="classifieds-daily-service-promo"
          aria-label={`معرفی روز: ${visibleDailyServicePromo.listing.name}، ${visibleDailyServicePromo.listing.category.name}`}
        >
          <span className="classifieds__daily-promo-icon" aria-hidden="true">
            {visibleDailyServicePromo.listing.category.icon ?? '🛠️'}
          </span>
          <span className="classifieds__daily-promo-copy">
            <small><b>معرفی روز</b><span>از مشاغل ثبت‌شدهٔ شهر {city.name}</span></small>
            <strong>{visibleDailyServicePromo.listing.name}</strong>
            <span>{visibleDailyServicePromo.listing.category.name} · {visibleDailyServicePromo.listing.phone}</span>
          </span>
          <span className="classifieds__daily-promo-cta">مشاهده <span aria-hidden="true">←</span></span>
        </Link>
      )}

      {error && <div className="banner banner--error" role="alert">{error}</div>}
      {servicePromosError && <div className="banner banner--error" role="alert">تأیید انتشار آگهی‌های خدمات در این شهر ممکن نشد؛ لطفاً بعداً دوباره تلاش کنید.</div>}

      {ads === null || (visibleAds.length === 0 && !visibleDailyBusiness && visibleServicePromos.length === 0 && !visibleDailyServicePromo && (!businessesLoaded || (!serviceWallPromos && !servicePromosError))) ? (
        <div className="classifieds__loading" aria-busy="true">در حال دریافت آگهی‌های {city.name}…</div>
      ) : visibleAds.length === 0 && !visibleDailyBusiness && visibleServicePromos.length === 0 && !visibleDailyServicePromo ? (
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
          {visibleDailyBusiness && (
            <Link href={`/business/${visibleDailyBusiness.id}`} className="classified-card" data-testid="daily-business-ad">
              <div className="classified-card__media">
                {visibleDailyBusiness.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- public business logo URL
                  <img src={thumbUrlFor(visibleDailyBusiness.logoUrl) ?? visibleDailyBusiness.logoUrl} alt="" loading="lazy" onError={thumbFallback(visibleDailyBusiness.logoUrl)} />
                ) : (
                  <span aria-hidden>{visibleDailyBusiness.category.icon ?? '🏪'}</span>
                )}
                <span className="classified-card__category">{visibleDailyBusiness.category.icon ?? '◆'} {visibleDailyBusiness.category.name}</span>
              </div>
              <div className="classified-card__body">
                <h2>{visibleDailyBusiness.name}</h2>
                <p>کسب‌وکار محلی ثبت‌شده · {visibleDailyBusiness.category.name}</p>
                <strong>مشاهدهٔ اطلاعات کسب‌وکار</strong>
                <small>{visibleDailyBusiness.address ? `${visibleDailyBusiness.address} · ` : ''}{city.name} · مشاهده جزئیات ←</small>
              </div>
            </Link>
          )}
          {visibleServicePromos.map((promo) => (
            <Link
              key={promo.postId}
              href={`/city/${city.slug}/services/${promo.listing.category.slug}`}
              className="classified-card"
              data-testid={`classified-service-${promo.listing.id}`}
            >
              <div className="classified-card__media">
                <span aria-hidden>{promo.listing.category.icon ?? '🛠️'}</span>
                <span className="classified-card__category">{promo.listing.category.icon ?? '◆'} {promo.listing.category.name}</span>
              </div>
              <div className="classified-card__body">
                <h2>{promo.listing.name}</h2>
                <p>معرفی شغل ثبت‌شده · {promo.listing.category.name}</p>
                <strong>{promo.listing.phone}</strong>
                <small>{promo.listing.description ? `${promo.listing.description} · ` : ''}{city.name} · مشاهده فهرست خدمات ←</small>
              </div>
            </Link>
          ))}
          {visibleAds.map((ad) => (
            <article className="classifieds__ad-row" key={ad.id} data-testid={`classified-row-${ad.id}`}>
              <Link href={`/ad/${ad.id}`} className="classified-card" data-testid={`classified-card-${ad.id}`}>
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
              {canManageAds && (
                <button
                  type="button"
                  className="classifieds__admin-delete"
                  aria-label={`حذف آگهی ${ad.title}`}
                  title="حذف آگهی"
                  data-testid={`admin-delete-ad-${ad.id}`}
                  onClick={() => void removeAd(ad)}
                >
                  🗑<span>حذف</span>
                </button>
              )}
            </article>
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
