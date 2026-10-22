'use client';

import Link from 'next/link';
import { formatPrice, thumbFallback, thumbUrlFor } from '@/lib/format';
import type { MenuShowcaseItem } from '@/lib/types';

export function MenuProductShowcase({ items, cityName }: { items: MenuShowcaseItem[]; cityName: string }) {
  return (
    <section
      className="menu-showcase"
      aria-label={`ویترین منو و محصولات شهر ${cityName}`}
      data-testid="menu-showcase"
    >
      <header className="menu-showcase__head">
        <span className="menu-showcase__icon" aria-hidden>🛍️</span>
        <div className="menu-showcase__titles">
          <h2>منو و محصولات شهر</h2>
          <p>محصول‌های تازه از کسب‌وکارهای محلی</p>
        </div>
        <Link href="/businesses" className="menu-showcase__all">
          همهٔ کسب‌وکارها <span aria-hidden>←</span>
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="menu-showcase__empty" data-testid="menu-showcase-empty">
          هنوز کسب‌وکاری منو و محصولی برای نمایش ثبت نکرده است.
        </p>
      ) : (
        <div
          className="menu-showcase__rail"
          role="region"
          aria-label={`کسب‌وکارهای دارای منو در شهر ${cityName}`}
          tabIndex={0}
          data-testid="menu-showcase-rail"
        >
          <ul className="menu-showcase__cards">
            {items.map((item) => (
              <li key={item.id} className="menu-showcase__slot">
                <Link
                  href={`/business/${item.id}`}
                  className={`menu-showcase__card menu-showcase__card--${item.subscriptionTier.toLowerCase()}`}
                  data-testid={`menu-showcase-business-${item.id}`}
                >
                  <span className="menu-showcase__business">
                    <span className="menu-showcase__logo" aria-hidden>
                      {item.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- remote uploaded image
                        <img
                          src={thumbUrlFor(item.logoUrl) ?? item.logoUrl}
                          alt=""
                          loading="lazy"
                          onError={thumbFallback(item.logoUrl)}
                        />
                      ) : (
                        <span>{item.category.icon ?? '🏪'}</span>
                      )}
                    </span>
                    <span className="menu-showcase__business-info">
                      <b className="menu-showcase__name">{item.name}</b>
                      <small className="menu-showcase__category">
                        <span aria-hidden>{item.category.icon ?? '◆'}</span> {item.category.name}
                      </small>
                    </span>
                    <span className="menu-showcase__tier" aria-label={item.subscriptionTier === 'GOLD' ? 'طلایی' : item.subscriptionTier === 'SILVER' ? 'نقره‌ای' : 'محلی'}>
                      {item.subscriptionTier === 'GOLD' ? '✦' : item.subscriptionTier === 'SILVER' ? '◇' : '•'}
                    </span>
                  </span>

                  <span className="menu-showcase__products" aria-label="محصولات نمونه">
                    {item.products.slice(0, 2).map((product) => (
                      <span
                        key={product.id}
                        className={`menu-showcase__product${product.isAvailable ? '' : ' menu-showcase__product--unavailable'}`}
                      >
                        <span className="menu-showcase__product-image" aria-hidden>
                          {product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- remote uploaded image
                            <img
                              src={thumbUrlFor(product.imageUrl) ?? product.imageUrl}
                              alt=""
                              loading="lazy"
                              onError={thumbFallback(product.imageUrl)}
                            />
                          ) : (
                            <span>🍽️</span>
                          )}
                        </span>
                        <span className="menu-showcase__product-info">
                          <b>{product.name}</b>
                          <small>{product.isAvailable ? formatPrice(product.price) : 'ناموجود'}</small>
                        </span>
                      </span>
                    ))}
                  </span>

                  <span className="menu-showcase__open">مشاهدهٔ منو و محصولات <span aria-hidden>←</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
