'use client';

import Link from 'next/link';
import { formatRating, thumbFallback, thumbUrlFor } from '@/lib/format';
import type { ShowcaseItem } from '@/lib/types';

export interface ShowcaseMarqueeProps {
  items: ShowcaseItem[];
  loading: boolean;
}

/**
 * «ویترین طلایی» (Phase 9): the animated golden panel above the city map.
 * The card list is rendered twice and the CSS `showcase-marquee` animation
 * shifts the track by exactly one copy, so it loops seamlessly — RTL-safe
 * (translateX +50% in an RTL flex row). Hovering or focusing a card pauses
 * the motion; `prefers-reduced-motion` turns it into a plain scroll strip.
 * City/tier data comes from the API — nothing is hard-coded here.
 */
export function ShowcaseMarquee({ items, loading }: ShowcaseMarqueeProps) {
  // Each half of the track must be at least a viewport wide, otherwise a short
  // list would visibly stutter. Repeat the list inside each half as needed —
  // the two halves stay identical, so the 50% shift loops seamlessly.
  const copies = Math.max(1, Math.ceil(4 / Math.max(items.length, 1)));
  // interleave repeats so the first `items.length` entries are the real list
  const half = items.length > 0 ? Array.from({ length: copies }, () => items).flat() : [];
  const loop = [...half, ...half];

  return (
    <section className="showcase" aria-label="ویترین طلایی" data-testid="showcase">
      <div className="showcase__head">
        <span className="showcase__crown" aria-hidden>
          👑
        </span>
        <div className="showcase__titles">
          <h2>ویترین طلایی</h2>
          <p>برترین کسب‌وکارهای این شهر</p>
        </div>
        <Link href="/plans" className="pill pill--gold showcase__cta" data-testid="showcase-cta">
          <span className="showcase__cta-icon" aria-hidden>
            ✨
          </span>{' '}
          معرفی کسب‌وکار من
        </Link>
      </div>

      {loading ? (
        <p className="muted showcase__empty" aria-busy>
          در حال بارگذاری ویترین…
        </p>
      ) : items.length === 0 ? (
        <div className="showcase__empty-card" data-testid="showcase-empty">
          <span aria-hidden>🌟</span>
          <p>هنوز کسب‌وکار طلایی‌ای در این شهر ثبت نشده — اولین نفر باشید.</p>
          <Link href="/plans" className="pill pill--gold">
            👑 مشاهده اشتراک‌ها
          </Link>
        </div>
      ) : (
        <div className="showcase__viewport" data-testid="showcase-viewport">
          <ul className="showcase__track">
            {loop.map((item, i) => (
              <li
                key={`${item.id}-${i}`}
                className={`showcase-card${item.subscriptionTier === 'GOLD' ? ' showcase-card--gold' : ' showcase-card--silver'}`}
                // every repeat is decorative — keep it out of the a11y tree
                aria-hidden={i >= items.length || undefined}
                data-testid={i < items.length ? `showcase-${item.id}` : undefined}
              >
                <span className="showcase-card__logo" aria-hidden>
                  {item.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote media
                    <img
                      src={thumbUrlFor(item.logoUrl) ?? item.logoUrl}
                      alt=""
                      loading="lazy"
                      onError={thumbFallback(item.logoUrl)}
                    />
                  ) : (
                    <span className="showcase-card__emoji">🏪</span>
                  )}
                  {item.subscriptionTier === 'GOLD' && (
                    <span className="showcase-card__crown" title="طلایی">
                      👑
                    </span>
                  )}
                </span>
                <span className="showcase-card__body">
                  <Link href={`/business/${item.id}`} className="showcase-card__name" tabIndex={i >= items.length ? -1 : undefined}>
                    {item.name}
                  </Link>
                  <span className="showcase-card__meta">
                    <span className="chip" style={item.category.color ? { background: item.category.color } : undefined}>
                      {item.category.icon ?? '◆'} {item.category.name}
                    </span>
                    <span className="showcase-card__rating">{formatRating(item.rating, item.ratingCount)}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
