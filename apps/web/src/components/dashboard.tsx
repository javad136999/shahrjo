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

function Section({
  title,
  hint,
  count,
  loading,
  emptyText,
  children,
}: {
  title: string;
  hint?: string;
  count: number;
  loading: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dash-section" aria-label={title}>
      <div className="dash-section__head">
        <h2>{title}</h2>
        {hint && <span className="muted">{hint}</span>}
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

/** Read-only dashboard of one city: news, ads and businesses (Phase 4). */
export function CityDashboard({ city, news, ads, businesses, loading, feedError }: CityDashboardProps) {
  return (
    <div className="dashboard">
      <header className="dash-header">
        <p className="dash-header__province">
          استان {city.province.name} {city.isFeatured && <span className="badge">ویژه</span>}
        </p>
        <h1>{city.name}</h1>
        <div className="dash-header__actions">
          <Link href="/" className="btn btn-ghost">
            تغییر شهر
          </Link>
          <Link href="/login" className="btn btn-ghost">
            ورود با موبایل
          </Link>
        </div>
      </header>

      {feedError && (
        <div className="banner banner--error" role="alert">
          <span>{feedError}</span>
        </div>
      )}

      <Section
        title="اخبار شهر"
        hint={loading ? undefined : `${news.length} خبر`}
        count={news.length}
        loading={loading}
        emptyText="هنوز خبری برای این شهر منتشر نشده است."
      >
        <ul className="card-grid">
          {news.map((item) => (
            <li key={item.id} className="content-card" data-testid={`news-${item.id}`}>
              {item.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- remote media, no next.config images yet
                <img className="content-card__cover" src={item.coverUrl} alt="" loading="lazy" />
              )}
              <div className="content-card__body">
                {item.category && <span className="chip">{item.category.name}</span>}
                <h3>{item.title}</h3>
                {item.excerpt && <p className="muted">{item.excerpt}</p>}
                <time className="muted small">{formatDate(item.publishedAt)}</time>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="آگهی‌ها"
        hint={loading ? undefined : `${ads.length} آگهی`}
        count={ads.length}
        loading={loading}
        emptyText="فعلاً آگهی فعالی در این شهر نیست."
      >
        <ul className="card-grid">
          {ads.map((item) => (
            <li key={item.id} className="content-card" data-testid={`ad-${item.id}`}>
              {item.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- remote media, no next.config images yet
                <img className="content-card__cover" src={item.coverUrl} alt="" loading="lazy" />
              )}
              <div className="content-card__body">
                <span className="chip">{item.category.name}</span>
                <h3>{item.title}</h3>
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
        title="کسب‌وکارها"
        hint={loading ? undefined : `${businesses.length} کسب‌وکار`}
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
                  {item.subscriptionTier === 'GOLD' && <span className="badge">طلایی</span>}
                  {item.subscriptionTier === 'SILVER' && <span className="badge badge--silver">نقره‌ای</span>}
                </div>
                <h3>{item.name}</h3>
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
