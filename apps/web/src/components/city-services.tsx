'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  createServiceListing,
  getCityServiceListings,
  getServiceCategories,
  getTokens,
} from '@/lib/api';
import type { ServiceListingItem, BusinessCategoryOption } from '@/lib/types';

/**
 * The two service-desk tiles inside the «به شهر X خوش آمدید»
 * card on the city home page:
 *
 * - **راست — «شغلتو ثبت کن»**: a tradesperson registers their trade, phone and
 *   a line about their services. It creates a lightweight ServiceListing, never
 *   a Business profile, menu, or product list; the category list is service-only.
 * - **چپ — «چه خدماتی در شهر … نیاز داری»**: pick a service and get every
 *   tradesperson who registered through the tile in a closable, phone-friendly results dialog.
 *
 * The actions stay in two columns on desktop and mobile; service categories
 * inside the finder are arranged in a separate, scan-friendly two-column grid.
 */

/** Which of the two panels is open, if any. */
type Panel = 'register' | 'find' | null;

export interface CityServicesProps {
  /** City display name — used in the «چه خدماتی در شهر …» heading. */
  cityName: string;
  /** City slug — the service-listings API filters entries by slug, never by name. */
  citySlug: string;
  /** Re-read after a successful registration so a new listing shows at once. */
  onRegistered?: () => void;
}

const emptyForm = { name: '', categoryId: '', phone: '', description: '' };

const normalizePersianSearch = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u200c\u200d\s]+/g, '')
    .trim()
    .toLocaleLowerCase('fa-IR');

export function CityServices({ cityName, citySlug, onRegistered }: CityServicesProps) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [categories, setCategories] = useState<BusinessCategoryOption[] | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Selected service slug in the finder panel (null = nothing picked yet). */
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [serviceQuery, setServiceQuery] = useState('');
  const [results, setResults] = useState<ServiceListingItem[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const requestSequence = useRef(0);
  const closeResultsButton = useRef<HTMLButtonElement>(null);

  // Categories load once, lazily, on the first time either panel opens.
  useEffect(() => {
    if (!panel || categories) return;
    let alive = true;
    getServiceCategories()
      .then((list) => alive && setCategories(list))
      .catch((err: unknown) => {
        if (alive) setError(err instanceof ApiError ? err.message : 'دریافت فهرست خدمات ناموفق بود');
      });
    return () => {
      alive = false;
    };
  }, [panel, categories]);

  useEffect(() => {
    if (!resultsOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => closeResultsButton.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setResultsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [resultsOpen]);

  const toggle = (next: Exclude<Panel, null>) => {
    setPanel((current) => (current === next ? null : next));
    setResultsOpen(false);
    setError(null);
    setDone(null);
  };

  const valid = form.name.trim().length >= 2 && form.categoryId !== '' && form.phone.trim().length >= 4;

  const filteredCategories = (categories ?? []).filter((category) => {
    const query = normalizePersianSearch(serviceQuery);
    if (!query) return true;
    return normalizePersianSearch(`${category.name} ${category.slug}`).includes(query);
  });
  const selectedCategory = categories?.find((category) => category.slug === activeSlug) ?? null;

  const searchService = () => {
    const match = serviceQuery.trim()
      ? filteredCategories[0]
      : filteredCategories.find((category) => category.slug === activeSlug) ?? filteredCategories[0];
    void pickService(match?.slug ?? null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    if (!getTokens()) {
      router.replace('/login?next=/');
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await createServiceListing({
        citySlug,
        name: form.name.trim(),
        categoryId: Number(form.categoryId),
        phone: form.phone.trim(),
        description: form.description.trim() || undefined,
      });
      setForm({ ...emptyForm });
      setDone('ثبت شد؛ شغل شما در فهرست خدمات شهر قرار گرفت. صفحهٔ کسب‌وکار یا منو ساخته نشد.');
      onRegistered?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ثبت شغل ناموفق بود؛ دوباره تلاش کنید');
    } finally {
      setBusy(false);
    }
  };

  const pickService = useCallback(
    async (slug: string | null) => {
      setActiveSlug(slug);
      setResults(null);
      setFindError(null);
      if (!slug) {
        setResultsOpen(false);
        setFinding(false);
        return;
      }
      setResultsOpen(true);
      const requestId = ++requestSequence.current;
      setFinding(true);
      try {
        const list = await getCityServiceListings(citySlug, 200, slug);
        if (requestId === requestSequence.current) setResults(list);
      } catch (err) {
        if (requestId === requestSequence.current) {
          setFindError(err instanceof ApiError ? err.message : 'دریافت فهرست مشاغل ناموفق بود');
        }
      } finally {
        if (requestId === requestSequence.current) setFinding(false);
      }
    },
    [citySlug],
  );

  return (
    <section className="city-services" data-testid="city-services" aria-label="دفتر خدمات شهر">
      <div className="city-services__tiles">
        <button
          type="button"
          className={`service-tile service-tile--register${panel === 'register' ? ' is-open' : ''}`}
          aria-expanded={panel === 'register'}
          data-testid="service-tile-register"
          onClick={() => toggle('register')}
        >
          <span className="service-tile__icon" aria-hidden>
            🛠️
          </span>
          <span className="service-tile__copy">
            <b>شغلتو ثبت کن</b>
            <small>فقط شغل، خدمات و شماره تماس</small>
          </span>
        </button>

        <button
          type="button"
          className={`service-tile service-tile--find${panel === 'find' ? ' is-open' : ''}`}
          aria-expanded={panel === 'find'}
          data-testid="service-tile-find"
          onClick={() => toggle('find')}
        >
          <span className="service-tile__icon" aria-hidden>
            🔎
          </span>
          <span className="service-tile__copy">
            <b>چه خدماتی در شهر {cityName} نیاز داری؟</b>
            <small>فهرست مشاغل ثبت‌شده</small>
          </span>
        </button>
      </div>

      {panel === 'register' && (
        <form className="service-panel" onSubmit={submit} noValidate data-testid="service-register">
          <h3>شغلتو ثبت کن</h3>
          <p className="muted small">
            فقط عنوان شغل، دستهٔ خدمات و شمارهٔ تماس ثبت می‌شود؛ پروفایل کسب‌وکار، منو یا محصولی ساخته نمی‌شود.
          </p>

          <label htmlFor="svc-name">عنوان شغل</label>
          <input
            id="svc-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="مثلاً کابینت‌کار"
            minLength={2}
            maxLength={160}
            required
            data-testid="service-name"
          />

          <label htmlFor="svc-cat">دسته‌بندی خدمات</label>
          <select
            id="svc-cat"
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            required
            data-testid="service-category"
          >
            <option value="">— انتخاب خدمت —</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </option>
            ))}
          </select>

          <label htmlFor="svc-phone">شماره تماس</label>
          <input
            id="svc-phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="۰۹۱۲…"
            maxLength={15}
            inputMode="tel"
            dir="ltr"
            required
            data-testid="service-phone"
          />

          <label htmlFor="svc-desc">خدماتی که ارائه می‌کنی — اختیاری</label>
          <input
            id="svc-desc"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="مثلاً نصب، تعمیر و سرویس کولر"
            maxLength={500}
          />

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {done && (
            <p className="chip chip--ok" role="status">
              ✓ {done}
            </p>
          )}

          <button type="submit" className="btn btn-primary" disabled={!valid || busy} data-testid="service-submit">
            {busy ? 'در حال ثبت…' : 'انتشار شغل'}
          </button>
        </form>
      )}

      {panel === 'find' && (
        <div className="service-panel" data-testid="service-find">
          <h3>چه خدماتی در شهر {cityName} نیاز داری؟</h3>
          <p className="muted small">خدمت مورد نظرت را انتخاب کن تا مشاغل ثبت‌شدهٔ همان خدمت را ببینی.</p>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          {!categories && !error && (
            <p className="muted loading" aria-busy>
              در حال بارگذاری خدمات…
            </p>
          )}

          {categories && (
            <>
              <div className="service-search" role="search">
                <label htmlFor="service-query">جستجوی خدمت</label>
                <div className="service-search__row">
                  <input
                    id="service-query"
                    value={serviceQuery}
                    onChange={(e) => setServiceQuery(e.target.value)}
                    placeholder="مثلاً کابینت‌کار یا تعمیرکار"
                    type="text"
                    inputMode="search"
                    autoComplete="off"
                    dir="auto"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        searchService();
                      }
                    }}
                    data-testid="service-search-input"
                  />
                  <button
                    type="button"
                    className="btn btn-primary service-search__button"
                    disabled={filteredCategories.length === 0}
                    onClick={searchService}
                    data-testid="service-search-button"
                  >
                    جستجو
                  </button>
                </div>
              </div>
              <div className="service-chips" role="listbox" aria-label="فهرست خدمات" data-testid="service-chips">
              {filteredCategories.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  role="option"
                  aria-selected={activeSlug === c.slug}
                  className={`service-chip${activeSlug === c.slug ? ' is-active' : ''}`}
                  data-testid={`service-chip-${c.slug}`}
                  onClick={() => void pickService(c.slug)}
                >
                  <span aria-hidden>{c.icon ?? '◆'}</span>
                  {c.name}
                </button>
              ))}
              </div>
            </>
          )}

        </div>
      )}

      {resultsOpen && activeSlug && selectedCategory && (
        <div
          className="service-results-overlay"
          data-testid="service-results-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) setResultsOpen(false);
          }}
        >
          <section
            className="service-results-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-results-title"
            data-testid="service-results-dialog"
          >
            <header className="service-results-dialog__head">
              <div>
                <p className="service-results-dialog__eyebrow">فهرست متخصصان شهر {cityName}</p>
                <h2 id="service-results-title">
                  <span aria-hidden>{selectedCategory.icon ?? '◆'}</span> {selectedCategory.name}
                </h2>
                <p>شغل‌های ثبت‌شده و شمارهٔ تماس مستقیم؛ بدون صفحهٔ کسب‌وکار</p>
              </div>
              <button
                ref={closeResultsButton}
                type="button"
                className="service-results-dialog__close"
                aria-label="بستن فهرست کسب‌وکارها"
                data-testid="service-results-close"
                onClick={() => setResultsOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="service-results-dialog__content" aria-live="polite">
              {finding && (
                <p className="service-results-loading" role="status" aria-busy="true">
                  <span className="service-results-loading__spinner" aria-hidden />
                  در حال جستجوی شغل‌های ثبت‌شده…
                </p>
              )}

              {!finding && findError && (
                <div className="service-results-error" role="alert">
                  <p>{findError}</p>
                  <button type="button" className="btn btn-primary" onClick={() => void pickService(activeSlug)}>
                    تلاش دوباره
                  </button>
                </div>
              )}

              {!finding && !findError && results?.length === 0 && (
                <div className="service-results-empty" data-testid="service-results-empty" role="status">
                  <span className="service-results-empty__icon" aria-hidden>🔎</span>
                  <h3>شغلی ثبت نشده است</h3>
                  <p>برای «{selectedCategory.name}» هنوز شغلی در شهر {cityName} ثبت نشده.</p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    data-testid="service-empty-register"
                    onClick={() => {
                      setForm((current) => ({ ...current, categoryId: String(selectedCategory.id) }));
                      setPanel('register');
                      setError(null);
                      setDone(null);
                      setResultsOpen(false);
                    }}
                  >
                    ثبت اولین شغل در این دسته
                  </button>
                </div>
              )}

              {!finding && !findError && results && results.length > 0 && (
                <>
                  <p className="service-results-count" data-testid="service-results-count">
                    {results.length.toLocaleString('fa-IR')} شغل پیدا شد
                  </p>
                  <div className="service-results-table-wrap" data-testid="service-results">
                    <table className="service-results-table">
                      <thead>
                        <tr>
                          <th scope="col">عنوان شغل و خدمات</th>
                          <th scope="col">شماره تماس</th>
                          <th scope="col">تماس</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((listing) => (
                          <tr key={listing.id} data-testid={`service-result-${listing.id}`}>
                            <td data-label="عنوان شغل و خدمات">
                              <strong>{listing.name}</strong>
                              <small>
                                {listing.category.icon ? `${listing.category.icon} ` : ''}
                                {listing.category.name}
                              </small>
                              {listing.description && <small>{listing.description}</small>}
                            </td>
                            <td data-label="شماره تماس" className="service-results-table__phone">
                              <a href={`tel:${listing.phone}`} dir="ltr">{listing.phone}</a>
                            </td>
                            <td data-label="تماس" className="service-results-table__actions">
                              <a className="btn btn-primary" href={`tel:${listing.phone}`}>
                                تماس مستقیم
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <footer className="service-results-dialog__foot">
              <button type="button" className="btn btn-ghost" onClick={() => setResultsOpen(false)}>
                بازگشت به فهرست خدمات
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
