import Link from 'next/link';
import { formatDate, formatPrice, formatRating } from '@/lib/format';
import type { AdItem, BusinessItem, City, NewsItem } from '@/lib/types';

export interface CityDashboardProps {
  city: City;
  news: NewsItem[];
  ads: AdItem[];
  businesses: BusinessItem[];
  /** true while feeds are still loading */
  loading: boolean;
  /** non-fatal feed error (banner) */
  feedError: string | null;
}

/** Quick stat tile under the hero (JamCity-style emoji counters). */
function Stat({ icon, tone, value, label }: { icon: string; tone?: string; value: number; label: string }) {
  return (
    <div className="stat-card">
      <span className={`icon-tile${tone ? ` icon-tile--${tone}` : ''}`} aria-hidden>
        {icon}
      </span>
      <div>
        <strong data-testid={`stat-${label}`}>{value.toLocaleString('fa-IR')}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
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
      ) : count === 0 ? (
        <p className="empty-state">{emptyText}</p>
      ) : (
        children
      )}
    </section>
  );
}

/**
 * City dashboard (Phase 4) in JamCity-inspired style: gradient hero card,
 * emoji stat tiles, icon-tile section heads with live count chips, and
 * pastel-bordered cards with a golden showcase treatment for GOLD businesses.
 * City names always come from the data — never from the code.
 */
export function CityDashboard({ city, news, ads, businesses, loading, feedError }: CityDashboardProps) {
  return (
    <div className="dashboard">
      <header className="dash-header">
        <span className="icon-tile icon-tile--city icon-tile--lg" aria-hidden>
          🏙
        </span>
        <p className="dash-header__province">
          استان {city.province.name} {city.isFeatured && <span className="badge">ویژه</span>}
        </p>
        <h1>{city.name}</h1>
        <div className="dash-header__actions">
          <Link href="/ads/new" className="pill pill--accent">
            <span aria-hidden>📝</span> ثبت آگهی
          </Link>
          <Link href="/" className="pill">
            <span aria-hidden>🏙</span> تغییر شهر
          </Link>
          <Link href="/login" className="pill">
            <span aria-hidden>👤</span> ورود با موبایل
          </Link>
        </div>
      </header>

      {feedError && (
        <div className="banner banner--error" role="alert">
          <span>{feedError}</span>
        </div>
      )}

      <div className="stats-row">
        <Stat icon="📰" tone="news" value={news.length} label="خبر" />
        <Stat icon="📋" tone="ads" value={ads.length} label="آگهی" />
        <Stat icon="🏬" tone="gold" value={businesses.length} label="کسب‌وکار" />
      </div>

      <Section
        id="news"
        icon="📰"
        tone="news"
        title="اخبار شهر"
        subtitle="آخرین اخبار و اتفاقات مهم شهر"
        live
        unit="خبر"
        count={news.length}
        loading={loading}
        emptyText="هنوز خبری برای این شهر منتشر نشده است."
      >
        <ul className="card-grid">
          {news.map((item) => (
            <li key={item.id} className="content-card" data-testid={`news-${item.id}`}>
              {item.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote media, no next.config images yet
                <img className="content-card__cover" src={item.coverUrl} alt="" loading="lazy" />
              ) : (
                <div className="content-card__placeholder" aria-hidden>
                  📰
                </div>
              )}
              <div className="content-card__body">
                {item.category && <span className="chip">{item.category.name}</span>}
                <h3>
                  <Link href={`/news/${item.slug}`} className="card-link">
                    {item.title}
                  </Link>
                </h3>
                {item.excerpt && <p className="muted">{item.excerpt}</p>}
                <time className="muted small">{formatDate(item.publishedAt)}</time>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="ads"
        icon="📋"
        tone="ads"
        title="آگهی‌ها"
        subtitle="آگهی‌های تأییدشده شهروندان"
        unit="آگهی"
        count={ads.length}
        loading={loading}
        emptyText="فعلاً آگهی فعالی در این شهر نیست."
      >
        <ul className="card-grid">
          {ads.map((item) => (
            <li key={item.id} className="content-card" data-testid={`ad-${item.id}`}>
              {item.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote media, no next.config images yet
                <img className="content-card__cover" src={item.coverUrl} alt="" loading="lazy" />
              ) : (
                <div className="content-card__placeholder" aria-hidden>
                  🛍️
                </div>
              )}
              <div className="content-card__body">
                <span className="chip">
                  {item.category.icon ? `${item.category.icon} ` : ''}
                  {item.category.name}
                </span>
                <h3>
                  <Link href={`/ad/${item.id}`} className="card-link">
                    {item.title}
                  </Link>
                </h3>
                <p className="price" data-testid={`ad-${item.id}-price`}>
                  {formatPrice(item.price)}
                </p>
                <p className="muted small">
                  {item.viewCount.toLocaleString('fa-IR')} بازدید {formatDate(item.publishedAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="businesses"
        icon="🏬"
        tone="gold"
        title="کسب‌وکارها"
        subtitle="کسب‌وکارهای منتخب و برتر شهر"
        unit="کسب‌وکار"
        count={businesses.length}
        loading={loading}
        emptyText="هنوز کسب‌وکار تأییدشده‌ای در این شهر ثبت نشده است."
      >
        <ul className="card-grid">
          {businesses.map((item) => (
            <li
              key={item.id}
              className={`content-card${item.subscriptionTier === 'GOLD' ? ' content-card--gold' : ''}`}
              data-testid={`business-${item.id}`}
            >
              <div className="content-card__body">
                <div className="business-line">
                  <span className="chip" style={item.category.color ? { background: item.category.color } : undefined}>
                    {item.category.icon ?? '◆'} {item.category.name}
                  </span>
                  {item.subscriptionTier === 'GOLD' && (
                    <span className="badge badge--gold">👑 طلایی</span>
                  )}
                  {item.subscriptionTier === 'SILVER' && <span className="badge badge--silver">نقره‌ای</span>}
                </div>
                <h3>
                  <Link href={`/business/${item.id}`} className="card-link">
                    {item.name}
                  </Link>
                </h3>
                <p className="muted small">{formatRating(item.rating, item.ratingCount)}</p>
                {item.address && <p className="muted small">📍 {item.address}</p>}
                {item.phone && (
                  <p className="muted small" dir="ltr">
                    📞 {item.phone}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
