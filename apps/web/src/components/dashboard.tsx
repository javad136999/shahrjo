import Link from 'next/link';
import { CityMap } from '@/components/city-map';
import { CityServices } from '@/components/city-services';
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

/**
 * City home page: one welcome card with the city wall and service actions,
 * then the golden showcase and the city map.
 * News, ads and businesses live on their own pages now — the home page
 * deliberately stays light.
 * City names always come from the data — never from the code.
 */
export function CityDashboard({ city, showcase, mapData, loading, feedError }: CityDashboardProps) {
  return (
    <div className="dashboard">
      <section className="dash-welcome" data-testid="dash-welcome" aria-label={`خوش‌آمدگویی شهر ${city.name}`}>
        <header className="dash-welcome__head">
          <div className="dash-welcome__greeting">
            <span className="dash-welcome__eyebrow">شهر شما، یک قدم نزدیک‌تر</span>
            <h1>به شهر {city.name} خوش آمدید</h1>
          </div>
          <Link href="/wall" className="wall-cta" data-testid="wall-cta">
            <span className="wall-cta__icon" aria-hidden>💗</span>
            <span className="wall-cta__copy"><b>ورود به دیوار شهر</b><small>گفت‌وگو با همشهری‌ها</small></span>
            {/* the entry reads as «open» — the little white tick like before */}
            <span className="wall-cta__tick" aria-hidden>✓</span>
            <span className="wall-cta__arrow" aria-hidden>←</span>
          </Link>
        </header>
        <CityServices cityName={city.name} citySlug={city.slug} />
      </section>

      {feedError && (
        <div className="banner banner--error" role="alert">
          <span>{feedError}</span>
        </div>
      )}

      {/* The golden showcase and its product entry lead into the map. */}
      <ShowcaseMarquee items={showcase} loading={loading} />
      {(loading || mapData) && (
        <section className="dash-map" id="map" aria-label="نقشه شهر">
          {mapData ? (
            <CityMap data={mapData} />
          ) : (
            <p className="muted" aria-busy>
              در حال بارگذاری…
            </p>
          )}
        </section>
      )}

    </div>
  );
}
