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
 * City home page: a single welcome card («به شهر X خوش آمدید») with the
 * beating-heart entry to the city wall, then the golden showcase and the
 * city map (framed by its own card, without a section title above it).
 * News, ads and businesses live on their own pages now — the home page
 * deliberately stays light.
 * City names always come from the data — never from the code.
 */
export function CityDashboard({ city, showcase, mapData, loading, feedError }: CityDashboardProps) {
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

      {/* ثبت شغل و جست‌وجوی خدمات زیر نقشه می‌آیند. */}
      <CityServices cityName={city.name} citySlug={city.slug} />
    </div>
  );
}
