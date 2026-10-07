'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, getAdDetail, getTokens, toggleAdFavorite } from '@/lib/api';
import { formatDate, formatPrice, thumbFallback, thumbUrlFor } from '@/lib/format';
import type { AdDetail as AdDetailData } from '@/lib/types';
import { StatusChip } from './my-ads';

/**
 * Ad detail page (Phase 6): gallery, contact actions and favorite toggle.
 * The API lets an owner open their own PENDING/REJECTED ad (preview), so the
 * moderation state is surfaced as a notice instead of a 404.
 */
export function AdDetail({ id }: { id: number }) {
  const router = useRouter();
  const [detail, setDetail] = useState<AdDetailData | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    if (!Number.isInteger(id) || id < 1) {
      setDetail(null);
      return;
    }
    let alive = true;
    setDetail(undefined);
    setError(null);
    setImageIndex(0);
    getAdDetail(id)
      .then((data) => alive && setDetail(data))
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) setDetail(null);
        else setError(err instanceof ApiError ? err.message : 'دریافت آگهی ناموفق بود');
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const onFavorite = async () => {
    if (!getTokens()) {
      router.push(`/login?next=/ad/${id}`);
      return;
    }
    setBusy(true);
    try {
      const res = await toggleAdFavorite(id);
      setDetail((current) => (current ? { ...current, favorited: res.favorited } : current));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ثبت علاقه‌مندی ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

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
        <span>چنین آگهی‌ای پیدا نشد یا از دسترس خارج شده است.</span>
        <Link href="/" className="btn btn-ghost">
          بازگشت به خانه
        </Link>
      </div>
    );
  }

  const isPending = detail.isOwner && detail.status === 'PENDING';
  const isRejected = detail.isOwner && detail.status === 'REJECTED';

  return (
    <div className="detail-page">
      <Link href={`/city/${detail.city.slug}`} className="back-link">
        ← بازگشت به {detail.city.name}
      </Link>

      {isPending && (
        <div className="notice notice--pending" role="status">
          این آگهی در انتظار تأیید ناظر است و هنوز در سایت نمایش داده نمی‌شود.
        </div>
      )}
      {isRejected && (
        <div className="notice notice--rejected" role="status">
          این آگهی رد شده است.
          {detail.rejectedReason && <> علت: {detail.rejectedReason}</>}
        </div>
      )}
      {error && (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
        </div>
      )}

      <article className="detail-card" data-testid="ad-detail">
        {detail.images.length > 0 && (
          <div className="detail-gallery">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote media */}
            <img
              className="detail-gallery__main"
              src={detail.images[imageIndex]}
              alt={detail.title}
              data-testid="ad-gallery-main"
            />
            {detail.images.length > 1 && (
              <div className="detail-gallery__thumbs">
                {detail.images.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    className={`detail-gallery__thumb${index === imageIndex ? ' is-active' : ''}`}
                    aria-label={`تصویر ${index + 1}`}
                    onClick={() => setImageIndex(index)}
                  >
                    {/* gallery picker uses the small thumbnail; the main pane keeps the full copy */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote media */}
                    <img src={thumbUrlFor(url) ?? url} alt="" onError={thumbFallback(url)} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="detail-meta">
          <span className="chip">
            {detail.category.icon ? `${detail.category.icon} ` : ''}
            {detail.category.name}
          </span>
          {detail.isOwner && <StatusChip status={detail.status} />}
          <span>📆 {formatDate(detail.publishedAt ?? detail.createdAt)}</span>
          <span>👁 {detail.viewCount.toLocaleString('fa-IR')} بازدید</span>
        </div>

        <h1 className="detail-title">{detail.title}</h1>
        <p className="detail-price" data-testid="ad-detail-price">
          {formatPrice(detail.price)}
        </p>
        <p className="detail-body">{detail.description}</p>
        {detail.address && <p className="muted">📍 {detail.address}</p>}

        <div className="detail-actions">
          {detail.phone && (
            <a className="pill pill--accent" href={`tel:${detail.phone}`} dir="ltr" data-testid="ad-call">
              📞 تماس {detail.phone}
            </a>
          )}
          <button
            type="button"
            className={`pill favorite-btn${detail.favorited ? ' is-on' : ''}`}
            onClick={onFavorite}
            disabled={busy}
            aria-pressed={detail.favorited}
            data-testid="ad-favorite"
          >
            {detail.favorited ? '❤️ ذخیره شده' : '🤍 ذخیره در علاقه‌مندی‌ها'}
          </button>
          {detail.isOwner && (
            <Link href="/profile" className="pill">
              📋 آگهی‌های من
            </Link>
          )}
        </div>
      </article>
    </div>
  );
}
