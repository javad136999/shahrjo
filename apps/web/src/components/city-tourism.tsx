'use client';

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
      <h1 className="sr-only">جاهای دیدنی {city.name}</h1>

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
                {spot.imageUrl ? (
                  <img
                    className="tourism-card__image"
                    src={spot.imageUrl}
                    alt={`عکس ${spot.name}`}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    fetchPriority={index === 0 ? 'high' : 'auto'}
                    decoding="async"
                    width="640"
                    height="420"
                  />
                ) : null}
                <span className="tourism-card__number">{new Intl.NumberFormat('fa-IR', { minimumIntegerDigits: 2 }).format(index + 1)}</span>
                {!spot.imageUrl ? <span className="tourism-card__emoji" aria-hidden>{spot.icon}</span> : null}
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
                  {spot.imageUrl && spot.imageSourceUrl ? <a className="tourism-card__image-credit" href={spot.imageSourceUrl} target="_blank" rel="noreferrer">عکس: {spot.imageCredit} · {spot.imageLicense} ↗</a> : null}
                  <a className="tourism-card__source" href={spot.sourceUrl} target="_blank" rel="noreferrer">منبع اطلاعات: {spot.sourceLabel} ↗</a>
                  <a className="tourism-card__map" href={mapsUrl(spot.latitude, spot.longitude, spot.name)} target="_blank" rel="noreferrer"><span>مشاهدهٔ مکان روی نقشه</span><span aria-hidden>↗</span></a>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <aside className="tourism-note"><span className="tourism-note__icon" aria-hidden>💚</span><div><strong>تصاویر بهینه و کم‌حجم</strong><p>عکس‌ها با اندازهٔ نمایشی کوچک و فشرده‌سازی WebP آماده شده‌اند؛ اعتبار و مجوز هر تصویر در بخش جزئیات همان مکان درج شده است.</p></div></aside>
    </div>
  );
}
