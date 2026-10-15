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

      {/* دفتر خدمات شهر: راست «شغلتو ثبت کن» (رایگان و فوری)، چپ «چه خدماتی
          در شهر … نیاز داری؟» با فهرست مشاغل ثبت‌شده و دکمهٔ تماس. زیر همین
          کارت و بالای نقشه می‌نشیند. */}
      <CityServices cityName={city.name} citySlug={city.slug} />

      {feedError && (
        <div className="banner banner--error" role="alert">
          <span>{feedError}</span>
        </div>
      )}

      {/* The map comes first now (Phase 11b): the city is the point of the
          page, the golden showcase sits right under it. The «نقشه شهر»
          title row and the category bar above the canvas are gone, so the
          canvas itself starts at the top of this card. */}
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

      {/* Golden showcase marquee — directly under the city map */}
      <ShowcaseMarquee items={showcase} loading={loading} />
    </div>
  );
}
