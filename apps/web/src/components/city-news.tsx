import Link from 'next/link';
import { formatDate, thumbFallback, thumbUrlFor } from '@/lib/format';
import type { City, NewsItem } from '@/lib/types';

export interface CityNewsViewProps {
  city: City;
  news: NewsItem[];
  loading: boolean;
  error: string | null;
}

/**
 * City news list (`/city/<slug>/news`): the news feed that moved out of the
 * city home page now lives on its own page, reachable from the header's
 * «اخبار» button and the bottom nav.
 */
export function CityNewsView({ city, news, loading, error }: CityNewsViewProps) {
  return (
    <div className="news-page">
      <header className="news-page__head" data-testid="news-head">
        <Link href={`/city/${city.slug}`} className="btn btn-ghost" data-testid="news-back">
          بازگشت به {city.name}
        </Link>
        <h1>
          اخبار شهر {city.name}
        </h1>
        <p className="muted">آخرین اخبار و اتفاقات مهم شهر</p>
      </header>

      {error && (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="muted" aria-busy>
          در حال بارگذاری…
        </p>
      ) : news.length === 0 ? (
        <p className="empty-state">هنوز خبری برای این شهر منتشر نشده است.</p>
      ) : (
        <ul className="card-grid" data-testid="news-list">
          {news.map((item) => (
            <li key={item.id} className="content-card" data-testid={`news-${item.id}`}>
              {item.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote media, no next.config images yet
                <img
                  className="content-card__cover"
                  src={thumbUrlFor(item.coverUrl) ?? item.coverUrl}
                  alt=""
                  loading="lazy"
                  onError={thumbFallback(item.coverUrl)}
                />
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
      )}
    </div>
  );
}
