'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, getNewsDetail } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { NewsDetail as NewsDetailData } from '@/lib/types';

/** Single news article (Phase 6): cover, meta, body paragraphs. */
export function NewsDetail({ slug }: { slug: string }) {
  const [detail, setDetail] = useState<NewsDetailData | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setDetail(undefined);
    setError(null);
    getNewsDetail(slug)
      .then((data) => alive && setDetail(data))
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) setDetail(null);
        else setError(err instanceof ApiError ? err.message : 'دریافت خبر ناموفق بود');
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  if (detail === undefined) {
    return (
      <p className="muted loading" aria-busy>
        در حال بارگذاری…
      </p>
    );
  }

  if (detail === null) {
    return (
      <div className="banner banner--error" role="alert">
        <span>چنین خبری پیدا نشد.</span>
        <Link href="/" className="btn btn-ghost">
          بازگشت به خانه
        </Link>
      </div>
    );
  }

  return (
    <div className="detail-page">
      <Link href={`/city/${detail.city.slug}`} className="back-link">
        ← بازگشت به {detail.city.name}
      </Link>

      {error && (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <article className="detail-card" data-testid="news-detail">
        <div className="detail-meta">
          {detail.category && <span className="chip">{detail.category.name}</span>}
          <span>📆 {formatDate(detail.publishedAt)}</span>
          <span>👁 {detail.viewCount.toLocaleString('fa-IR')} بازدید</span>
        </div>

        <h1 className="detail-title">{detail.title}</h1>
        {detail.excerpt && <p className="detail-lead muted">{detail.excerpt}</p>}

        {detail.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- remote media
          <img className="detail-cover" src={detail.coverUrl} alt="" loading="lazy" />
        )}

        <div className="detail-body">
          {detail.body.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </article>
    </div>
  );
}
