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
          {mapData ? <CityMap data={mapData} /> : null}
        </Section>
      )}
    </div>
  );
}
