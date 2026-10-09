'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CityMap } from '@/components/city-map';
import { ShowcaseMarquee } from '@/components/showcase-marquee';
import type { City, CityMapData, ShowcaseItem } from '@/lib/types';

export interface CityDashboardProps {
  city: City;
  /** paid-tier businesses for the golden marquee (Phase 9) */
  showcase: ShowcaseItem[];
  /** boundary + pinned businesses for the city map (Phase 9) */
  mapData: CityMapData | null;
  /** true while feeds are still loading */
  loading: boolean;
  /** non-fatal feed error (banner) */
  feedError: string | null;
}

function Section({
  id,
  icon,
  tone,
  title,
  subtitle,
  live,
  unit,
  count,
  loading,
  emptyText,
  showChildrenWhenEmpty = false,
  children,
}: {
  id: string;
  icon: string;
  tone: string;
  title: string;
  subtitle: string;
  live?: boolean;
  unit: string;
  count: number;
  loading: boolean;
  emptyText: string;
  /** keep rendering children even when count is 0 (e.g. the map) */
  showChildrenWhenEmpty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="dash-section" aria-label={title} id={id}>
      <div className="dash-section__head">
        <span className={`icon-tile icon-tile--${tone}`} aria-hidden>
          {icon}
        </span>
        <div className="dash-section__title">
          <h2>{title}</h2>
          <p className="dash-section__sub">{subtitle}</p>
        </div>
        {live && (
          <span className="live-badge">
            <span className="live-dot" aria-hidden />
            LIVE
          </span>
        )}
        <span className="count-chip">
          {count.toLocaleString('fa-IR')} {unit}
        </span>
      </div>
      {loading ? (
        <p className="muted" aria-busy>
          در حال بارگذاری…
        </p>
      ) : count === 0 && !showChildrenWhenEmpty ? (
        <p className="empty-state">{emptyText}</p>
      ) : (
        children
      )}
    </section>
  );
}

/**
 * City home page: a single welcome card («به شهر X خوش آمدید») with the
 * beating-heart entry to the city wall, then the golden showcase and the
 * city map. News, ads and businesses live on their own pages now — the home
 * page deliberately stays light.
 * City names always come from the data — never from the code.
 */
export function CityDashboard({ city, showcase, mapData, loading, feedError }: CityDashboardProps) {
  // Mirrors the map's ✨ category filter so the list below always agrees
  // with the pins on screen (same data source: /map payload).
  const [mapCat, setMapCat] = useState<string | null>(null);
  const mapBusinesses = mapData?.businesses ?? [];
  const shownBusinesses = mapBusinesses.filter((b) => mapCat === null || b.category.slug === mapCat);
  const catName = mapCat
    ? (mapBusinesses.find((b) => b.category.slug === mapCat)?.category.name ?? mapCat)
    : null;

  return (
    <div className="dashboard">
      <header className="dash-welcome" data-testid="dash-welcome">
        {/* red, heart-like pulse — the primary social entry of the city */}
        <Link href="/wall" className="wall-cta" data-testid="wall-cta">
          <span aria-hidden>❤️</span> ورود به دیوار شهر
        </Link>
        <h1>
          به شهر {city.name} خوش آمدید
        </h1>
      </header>

      {feedError && (
        <div className="banner banner--error" role="alert">
          <span>{feedError}</span>
        </div>
      )}

      {/* Golden showcase marquee — sits directly above the city map (Phase 9) */}
      <ShowcaseMarquee items={showcase} loading={loading} />

      {(loading || mapData) && (
        <Section
          id="map"
          icon="🗺"
          tone="city"
          title="نقشه شهر"
          subtitle="محدوده شهر و کسب‌وکارهای تأییدشده روی نقشه"
          unit="مکان"
          count={mapData?.businesses.length ?? 0}
          loading={loading && !mapData}
          emptyText="هنوز کسب‌وکاری با مختصات مشخص‌شده روی نقشه ثبت نشده است."
          showChildrenWhenEmpty
        >
          {mapData ? <CityMap data={mapData} onCategoryChange={setMapCat} /> : null}
        </Section>
      )}

      {mapData && (
        <section className="dash-section" aria-label="فهرست کسب‌وکارهای نقشه" id="map-list">
          <div className="dash-section__head">
            <span className="icon-tile" aria-hidden>📌</span>
            <div className="dash-section__title">
              <h2>فهرست همین نقشه</h2>
              <p className="dash-section__sub">
                {catName ? `فیلتر دسته: ${catName}` : 'کسب‌وکارهای دارای موقعیت، همراه با دسته‌بندی'}
              </p>
            </div>
            <span className="chip" data-testid="map-list-count">
              {shownBusinesses.length.toLocaleString('fa-IR')}
            </span>
          </div>

          {shownBusinesses.length === 0 ? (
            <p className="empty-state" data-testid="map-list-empty">
              🗂 کسب‌وکاری با این دسته‌بندی روی نقشه نیست.
            </p>
          ) : (
            <ul className="map-bizlist" data-testid="map-bizlist">
              {shownBusinesses.map((b) => (
                <li key={b.id}>
                  <a href={`/business/${b.id}`} className="map-bizlist__row">
                    <span className="map-bizlist__icon" aria-hidden>
                      {b.category.icon ?? '🏪'}
                    </span>
                    <strong className="map-bizlist__name">{b.name}</strong>
                    <span className="chip">{b.category.name}</span>
                    {b.subscriptionTier === 'GOLD' && (
                      <span className="map-bizlist__gold" title="کسب‌وکار طلایی">
                        👑
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
