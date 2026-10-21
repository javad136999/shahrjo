'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { getTourismSpots, tourismCategories } from '@/lib/tourism';
import type { City } from '@/lib/types';

export interface CityTourismViewProps { city: City }

function mapsUrl(latitude: number, longitude: number, name: string) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=${encodeURIComponent(name)}`;
}

export function CityTourismView({ city }: CityTourismViewProps) {
  const [activeCategory, setActiveCategory] = useState('همه');
  const spots = useMemo(() => getTourismSpots(city), [city]);
  const visibleSpots = useMemo(
    () => activeCategory === 'همه' ? spots : spots.filter((spot) => spot.category === activeCategory),
    [activeCategory, spots],
  );

  return (
    <div className="tourism-page">
      <header className="tourism-hero" data-testid="tourism-head">
        <div className="tourism-hero__glow" aria-hidden />
        <div className="tourism-hero__topline">
          <Link href={`/city/${city.slug}`} className="btn btn-ghost" data-testid="tourism-back">بازگشت به {city.name}</Link>
          <span className="tourism-hero__badge">راهنمای سفر</span>
        </div>
        <div className="tourism-hero__icon" aria-hidden>🧭</div>
        <p className="tourism-hero__eyebrow">شهر را از نگاه مسافر ببین</p>
        <h1>جاهای دیدنی {city.name}</h1>
        <p>مکان‌های منتخب با توضیح، دسته‌بندی، مختصات و لینک منبع معتبر برای برنامه‌ریزی سفر.</p>
        <div className="tourism-hero__stats" aria-label="خلاصه راهنما">
          <span><b>{new Intl.NumberFormat('fa-IR').format(spots.length)}</b> پیشنهاد منتخب</span>
          <span><b>۵</b> دسته‌بندی سفر</span>
          <span><b>نقشه</b> برای هر مکان</span>
        </div>
      </header>

      <section className="tourism-categories" aria-label="دسته‌بندی مکان‌ها">
        {tourismCategories.map((category) => (
          <button key={category.label} type="button" onClick={() => setActiveCategory(category.label)} className={`tourism-category${activeCategory === category.label ? ' is-active' : ''}`} aria-pressed={activeCategory === category.label}>
            <span aria-hidden>{category.icon}</span><span>{category.label}</span>
          </button>
        ))}
      </section>

      <div className="tourism-list-head">
        <div><p className="tourism-list-head__eyebrow">انتخاب‌های شهرجو</p><h2>{activeCategory === 'همه' ? 'برای شروع کجا برویم؟' : `مکان‌های ${activeCategory}`}</h2></div>
        <span className="count-chip">{new Intl.NumberFormat('fa-IR').format(visibleSpots.length)} مکان</span>
      </div>

      {visibleSpots.length === 0 ? <div className="empty-state tourism-empty">برای این دسته هنوز مکان پیشنهادی ثبت نشده است.</div> : (
        <ul className="tourism-grid" data-testid="tourism-list">
          {visibleSpots.map((spot, index) => (
            <li key={spot.id} className="tourism-card" data-testid={`tourism-${spot.id}`}>
              <div className="tourism-card__visual" style={{ '--tourism-accent': spot.accent } as React.CSSProperties}>
                <span className="tourism-card__number">{new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2 }).format(index + 1)}</span>
                <span className="tourism-card__emoji" aria-hidden>{spot.icon}</span>
                <span className="tourism-card__category">{spot.category}</span>
              </div>
              <details className="tourism-card__expand" data-testid={`tourism-details-${spot.id}`}>
                <summary className="tourism-card__summary">
                  <span className="tourism-card__summary-title">{spot.name}</span>
                  <span className="tourism-card__meta"><span>⏱ {spot.duration}</span><span>📍 {spot.locationLabel}</span></span>
                  <span className="tourism-card__toggle"><span className="tourism-card__toggle-open">مشاهدهٔ توضیحات و مشخصات</span><span className="tourism-card__toggle-close">بستن جزئیات</span><span className="tourism-card__chevron" aria-hidden>⌄</span></span>
                </summary>
                <div className="tourism-card__expanded-body">
                  <h3>دربارهٔ مکان</h3>
                  <p className="tourism-card__description">{spot.description}</p>
                  <p className="tourism-card__tip"><b>نکتهٔ بازدید:</b> {spot.tip}</p>
                  <dl className="tourism-card__specs">
                    <div><dt>دسته‌بندی</dt><dd>{spot.category}</dd></div>
                    <div><dt>زمان پیشنهادی</dt><dd>{spot.duration}</dd></div>
                    <div><dt>محدوده</dt><dd>{spot.locationLabel}</dd></div>
                    <div><dt>مختصات</dt><dd>{spot.latitude.toFixed(4)}، {spot.longitude.toFixed(4)}</dd></div>
                  </dl>
                  <a className="tourism-card__source" href={spot.sourceUrl} target="_blank" rel="noreferrer">منبع اطلاعات: {spot.sourceLabel} ↗</a>
                  <a className="tourism-card__map" href={mapsUrl(spot.latitude, spot.longitude, spot.name)} target="_blank" rel="noreferrer"><span>مشاهدهٔ مکان روی نقشه</span><span aria-hidden>↗</span></a>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <aside className="tourism-note"><span className="tourism-note__icon" aria-hidden>💚</span><div><strong>راهنمای سبک و کم‌حجم</strong><p>برای جلوگیری از پرشدن سرور، در این مرحله عکس محلی ذخیره نمی‌شود؛ هر مکان فقط دادهٔ متنی، مختصات و لینک منبع دارد و کاربر می‌تواند جزئیات و نقشه را باز کند.</p></div></aside>
    </div>
  );
}
