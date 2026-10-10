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

/** City home: welcome, full-width map, then the showcase without a redundant map heading. */
export function CityDashboard({ city, showcase, mapData, loading, feedError }: CityDashboardProps) {
  return (
    <div className="dashboard">
      <header className="dash-welcome" data-testid="dash-welcome">
        <Link href="/wall" className="wall-cta" data-testid="wall-cta">
          <span aria-hidden="true">❤️</span> ورود به دیوار شهر
        </Link>
        <h1>به شهر {city.name} خوش آمدید</h1>
      </header>

      {feedError && (
        <div className="banner banner--error" role="alert">
          <span>{feedError}</span>
        </div>
      )}

      {(loading || mapData) && (
        <section className="dash-map" aria-label={`نقشهٔ ${city.name}`} id="map">
          {loading && !mapData ? (
            <p className="muted" aria-busy="true">در حال بارگذاری نقشه…</p>
          ) : mapData ? (
            <CityMap data={mapData} />
          ) : null}
        </section>
      )}

      <ShowcaseMarquee items={showcase} loading={loading} />
    </div>
  );
}
