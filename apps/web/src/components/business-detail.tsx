'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, getBusinessDetail } from '@/lib/api';
import { formatDate, formatRating } from '@/lib/format';
import type { BusinessDetail as BusinessDetailData } from '@/lib/types';

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
    </div>
  );
}
