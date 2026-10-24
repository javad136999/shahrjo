'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { ApiError, getBusinessDetail, getMyBusinessReview, getTokens, saveBusinessReview } from '@/lib/api';
import { formatDate, formatPrice, formatRating, thumbFallback, thumbUrlFor } from '@/lib/format';
import type { BusinessDetail as BusinessDetailData, BusinessProductItem, BusinessReview } from '@/lib/types';

/** Menu rows grouped into their sections («نوشیدنی»، «غذاهای اصلی»…) in order. */
function menuSections(products: BusinessProductItem[]): { title: string; items: BusinessProductItem[] }[] {
  const groups: { title: string; items: BusinessProductItem[] }[] = [];
  for (const product of products) {
    const title = product.section?.trim() || 'بدون دسته';
    const group = groups.find((g) => g.title === title);
    if (group) group.items.push(product);
    else groups.push({ title, items: [product] });
  }
  return groups;
}

interface WorkingHour {
  day?: unknown;
  open?: unknown;
  close?: unknown;
}

/** Defensive rendering of the optional `workingHours` JSON field. */
function readHours(workingHours: unknown): { day: string; open: string; close: string }[] {
  if (!Array.isArray(workingHours)) return [];
  return workingHours
    .map((raw) => {
      const row = raw as WorkingHour;
      return {
        day: typeof row?.day === 'string' ? row.day : '',
        open: typeof row?.open === 'string' ? row.open : '',
        close: typeof row?.close === 'string' ? row.close : '',
      };
    })
    .filter((row) => row.day && (row.open || row.close));
}

interface SocialLinks {
  [key: string]: unknown;
}

/** Only real URLs are linked; anything else is shown as plain text. */
function readSocials(socialLinks: unknown): { label: string; href: string | null }[] {
  if (!socialLinks || typeof socialLinks !== 'object' || Array.isArray(socialLinks)) return [];
  const labels: Record<string, string> = {
    instagram: 'اینستاگرام',
    telegram: 'تلگرام',
    website: 'وب‌سایت',
    eita: 'ایتا',
    rubika: 'روبیکا',
  };
  return Object.entries(socialLinks as SocialLinks)
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .map(([key, value]) => {
      const str = value as string;
      const href = /^https?:\/\//i.test(str) ? str : null;
      return { label: labels[key] ?? key, href };
    });
}

/** Single business profile (Phase 6). */
export function BusinessDetail({ id }: { id: number }) {
  const [detail, setDetail] = useState<BusinessDetailData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [myReview, setMyReview] = useState<BusinessReview | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewBody, setReviewBody] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(id) || id < 1) {
      setDetail(null);
      return;
    }
    let alive = true;
    setDetail(undefined);
    setError(null);
    getBusinessDetail(id)
      .then((data) => alive && setDetail(data))
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 404) setDetail(null);
        else setError(err instanceof ApiError ? err.message : 'دریافت کسب‌وکار ناموفق بود');
      });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    let alive = true;
    const signedIn = Boolean(getTokens());
    setCanReview(signedIn);
    setMyReview(null);
    setReviewRating(0);
    setReviewBody('');
    setReviewError(null);
    setReviewMessage(null);
    if (!signedIn || !Number.isInteger(id) || id < 1) return () => { alive = false; };

    getMyBusinessReview(id)
      .then((review) => {
        if (!alive) return;
        setMyReview(review);
        if (review) {
          setReviewRating(review.rating);
          setReviewBody(review.body ?? '');
        }
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) setCanReview(false);
        else setReviewError(err instanceof ApiError ? err.message : 'دریافت نظر شما ناموفق بود');
      });

    return () => {
      alive = false;
    };
  }, [id]);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewError(null);
    setReviewMessage(null);
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError('لطفاً از ۱ تا ۵ ستاره انتخاب کنید');
      return;
    }
    setReviewBusy(true);
    try {
      const result = await saveBusinessReview(id, { rating: reviewRating, body: reviewBody.trim() });
      setMyReview(result.review);
      setReviewRating(result.review.rating);
      setReviewBody(result.review.body ?? '');
      setDetail((current) => current ? {
        ...current,
        rating: result.rating,
        ratingCount: result.ratingCount,
        reviews: [result.review, ...current.reviews.filter((review) => review.id !== result.review.id)].slice(0, 20),
      } : current);
      setReviewMessage('نظر شما ثبت شد');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setCanReview(false);
        setReviewError('برای ادامه، دوباره وارد حساب خود شوید');
      } else {
        setReviewError(err instanceof ApiError ? err.message : 'ثبت نظر ناموفق بود؛ دوباره تلاش کنید');
      }
    } finally {
      setReviewBusy(false);
    }
  }

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
        <span>چنین کسب‌وکاری پیدا نشد یا هنوز تأیید نشده است.</span>
        <Link href="/" className="btn btn-ghost">
          بازگشت به خانه
        </Link>
      </div>
    );
  }

  const hours = readHours(detail.workingHours);
  const socials = readSocials(detail.socialLinks);

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

      <article className="detail-card" data-testid="business-detail">
        <div className="business-hero">
          {detail.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote media
            <img className="business-hero__logo" src={detail.logoUrl} alt={detail.name} />
          ) : (
            <span className="icon-tile icon-tile--lg" aria-hidden>
              {detail.category.icon ?? '🏬'}
            </span>
          )}
          <div className="business-hero__info">
            <div className="detail-meta">
              <span
                className="chip"
                style={detail.category.color ? { background: detail.category.color } : undefined}
              >
                {detail.category.icon ?? '◆'} {detail.category.name}
              </span>
              {detail.subscriptionTier === 'GOLD' && <span className="badge badge--gold">👑 طلایی</span>}
              {detail.subscriptionTier === 'SILVER' && <span className="badge badge--silver">نقره‌ای</span>}
            </div>
            <h1 className="detail-title">{detail.name}</h1>
            <p className="muted small">
              {formatRating(detail.rating, detail.ratingCount)} · 👁{' '}
              {detail.viewCount.toLocaleString('fa-IR')} بازدید · عضو از {formatDate(detail.createdAt)}
            </p>
          </div>
        </div>

        {detail.description && <p className="detail-body">{detail.description}</p>}

        <ul className="contact-list">
          {detail.address && (
            <li>
              <span aria-hidden>📍</span> {detail.address}
            </li>
          )}
          {detail.phone && (
            <li>
              <span aria-hidden>📞</span>{' '}
              <a href={`tel:${detail.phone}`} dir="ltr" data-testid="business-call">
                {detail.phone}
              </a>
            </li>
          )}
          {hours.length > 0 && (
            <li>
              <span aria-hidden>🕘</span>
              <ul className="hours-list">
                {hours.map((row) => (
                  <li key={row.day}>
                    {row.day}: {row.open}
                    {row.close && ` — ${row.close}`}
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ul>

        {/* «منو و محصولات» — shown when the owner has registered any, including
            for visitors arriving from the business pin on the city map. */}
        {detail.products.length > 0 && (
          <section className="biz-menu-public" aria-label="منو و محصولات" data-testid="business-menu">
            <h2 className="biz-menu-public__title">
              🧾 منو و محصولات
              <span className="muted small"> ({detail.products.length.toLocaleString('fa-IR')} مورد)</span>
            </h2>
            {menuSections(detail.products).map((group) => (
              <div key={group.title} className="biz-menu-public__group" data-testid={`menu-group-${group.title}`}>
                <h3 className="biz-menu-public__section">{group.title}</h3>
                <ul className="biz-menu-public__list">
                  {group.items.map((product) => (
                    <li
                      key={product.id}
                      className={`biz-menu-public__item${product.isAvailable ? '' : ' is-soldout'}`}
                      data-testid={`menu-product-${product.id}`}
                    >
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- remote media
                        <img
                          className="biz-menu-public__thumb"
                          src={thumbUrlFor(product.imageUrl) ?? product.imageUrl}
                          onError={thumbFallback(product.imageUrl)}
                          alt=""
                        />
                      ) : (
                        <span className="biz-menu-public__thumb biz-menu-public__thumb--empty" aria-hidden>
                          🍽
                        </span>
                      )}
                      <div className="biz-menu-public__info">
                        <b>{product.name}</b>
                        {product.description && <small>{product.description}</small>}
                        {!product.isAvailable && <span className="badge badge--rose">ناموجود</span>}
                      </div>
                      <span className="biz-menu-public__price">{formatPrice(product.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {socials.length > 0 && (
          <div className="social-links">
            {socials.map((social) =>
              social.href ? (
                <a key={social.label} href={social.href} className="pill" target="_blank" rel="noreferrer">
                  {social.label}
                </a>
              ) : (
                <span key={social.label} className="pill">
                  {social.label}
                </span>
              ),
            )}
          </div>
        )}
      </article>

      <section className="business-reviews detail-card" aria-label="امتیاز و نظر کاربران" data-testid="business-reviews">
        <div className="business-reviews__heading">
          <div>
            <h2>امتیاز و نظر کاربران</h2>
            <p className="muted small">{formatRating(detail.rating, detail.ratingCount)}</p>
          </div>
        </div>

        {canReview ? (
          <form className="business-review-form" onSubmit={submitReview}>
            <fieldset className="business-review-form__rating">
              <legend>امتیاز شما</legend>
              <div className="business-review-stars" role="group" aria-label="انتخاب امتیاز از یک تا پنج">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`business-review-stars__button${value <= reviewRating ? ' is-selected' : ''}`}
                    aria-label={`${value.toLocaleString('fa-IR')} ستاره`}
                    aria-pressed={reviewRating === value}
                    onClick={() => setReviewRating(value)}
                    disabled={reviewBusy}
                  >
                    ★
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="business-review-form__label" htmlFor={`business-review-body-${id}`}>
              متن نظر <span className="muted">(اختیاری)</span>
            </label>
            <textarea
              id={`business-review-body-${id}`}
              className="business-review-form__textarea"
              value={reviewBody}
              onChange={(event) => setReviewBody(event.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="تجربه‌تان از این کسب‌وکار را برای دیگران بنویسید…"
              disabled={reviewBusy}
            />
            <div className="business-review-form__footer">
              <small className="muted">{reviewBody.length.toLocaleString('fa-IR')} از ۱۰۰۰ نویسه</small>
              <button className="btn btn-primary" type="submit" disabled={reviewBusy}>
                {reviewBusy ? 'در حال ثبت…' : myReview ? 'به‌روزرسانی نظر' : 'ثبت نظر'}
              </button>
            </div>
          </form>
        ) : (
          <div className="business-review-login">
            <span>برای ثبت امتیاز و نظر وارد حساب خود شوید.</span>
            <Link className="btn btn-ghost" href={`/login?next=/business/${id}`}>
              ورود و ثبت نظر
            </Link>
          </div>
        )}

        {reviewError && <p className="business-review-feedback is-error" role="alert">{reviewError}</p>}
        {reviewMessage && <p className="business-review-feedback is-success" role="status">{reviewMessage}</p>}

        <div className="business-review-list">
          {detail.reviews.length === 0 ? (
            <p className="muted small">هنوز نظری برای این کسب‌وکار ثبت نشده است. اولین نفر باشید.</p>
          ) : (
            detail.reviews.map((review) => (
              <article className="business-review-item" key={review.id}>
                <div className="business-review-item__meta">
                  <strong>{review.userName}</strong>
                  <span className="business-review-item__stars" aria-label={`${review.rating} از ۵ ستاره`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <span key={index} aria-hidden="true">{index < review.rating ? '★' : '☆'}</span>
                    ))}
                  </span>
                  <time className="muted small" dateTime={review.updatedAt}>{formatDate(review.updatedAt)}</time>
                </div>
                {review.body && <p className="business-review-item__body">{review.body}</p>}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
