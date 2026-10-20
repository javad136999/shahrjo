'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  createQuickBusiness,
  getCityBusinesses,
  getServiceCategories,
  getTokens,
} from '@/lib/api';
import type { BusinessItem, BusinessCategoryOption } from '@/lib/types';

/**
 * The two service-desk tiles inside the «به شهر X خوش آمدید»
 * card on the city home page:
 *
 * - **راست — «شغلتو ثبت کن»**: a tradesperson registers their trade, phone and
 *   a line of description. No payment, no admin step: `POST /businesses/quick`
 *   publishes it immediately, because the whole point is a neighbour finding
 *   and calling them the same minute. The category list is service-only, so a
 *   shop or restaurant cannot slip into the desk.
 * - **چپ — «چه خدماتی در شهر … نیاز داری»**: pick a service and get every
 *   tradesperson who registered through the tile, with a one-tap call button.
 *
 * The actions stay in two columns on desktop and mobile; service categories
 * inside the finder are arranged in a separate, scan-friendly two-column grid.
 */

/** Which of the two panels is open, if any. */
type Panel = 'register' | 'find' | null;

export interface CityServicesProps {
  /** City display name — used in the «چه خدماتی در شهر …» heading. */
  cityName: string;
  /** City slug — the content API filters businesses by slug, never by name. */
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
  const [results, setResults] = useState<BusinessItem[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);

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

  const toggle = (next: Exclude<Panel, null>) => {
    setPanel((current) => (current === next ? null : next));
    setError(null);
    setDone(null);
  };

  const valid = form.name.trim().length >= 2 && form.categoryId !== '' && form.phone.trim().length >= 4;

  const filteredCategories = (categories ?? []).filter((category) => {
    const query = normalizePersianSearch(serviceQuery);
    if (!query) return true;
    return normalizePersianSearch(`${category.name} ${category.slug}`).includes(query);
  });

  const searchService = () => {
    const match = filteredCategories.find((category) => category.slug === activeSlug) ?? filteredCategories[0];
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
      await createQuickBusiness({
        citySlug,
        name: form.name.trim(),
        categoryId: Number(form.categoryId),
        phone: form.phone.trim(),
        description: form.description.trim() || undefined,
      });
      setForm({ ...emptyForm });
      setDone('ثبت شد؛ شغل شما همین حالا در فهرست خدمات شهر دیده می‌شود.');
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
      if (!slug) return;
      setFinding(true);
      try {
        const list = await getCityBusinesses(citySlug, 200, slug);
        setResults(list);
      } catch (err) {
        setFindError(err instanceof ApiError ? err.message : 'دریافت فهرست مشاغل ناموفق بود');
      } finally {
        setFinding(false);
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
            <small>رایگان و فوری</small>
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
            ثبت رایگان است و بلافاصله منتشر می‌شود؛ همشهری‌ها می‌توانند با شما تماس بگیرند.
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

          <label htmlFor="svc-desc">توضیح کوتاه — اختیاری</label>
          <input
            id="svc-desc"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="مثلاً نصب و تعمیر کابینت آشپزخانه"
            maxLength={200}
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

          {finding && (
            <p className="muted loading" aria-busy>
              در حال جستجو…
            </p>
          )}
          {findError && (
            <p className="error" role="alert">
              {findError}
            </p>
          )}

          {!finding && activeSlug && results !== null && (
            <ul className="service-results" data-testid="service-results">
              {results.length === 0 ? (
                <li className="empty-state">هنوز کسی این خدمت را در شهر ثبت نکرده است.</li>
              ) : (
                results.map((b) => (
                  <li key={b.id} className="service-result" data-testid={`service-result-${b.id}`}>
                    <span className="service-result__main">
                      <b>{b.name}</b>
                      <small>
                        {b.category.icon ? `${b.category.icon} ` : ''}
                        {b.category.name}
                        {b.address ? ` · ${b.address}` : ''}
                      </small>
                    </span>
                    {b.phone && (
                      <a className="btn btn-primary service-result__call" href={`tel:${b.phone}`} dir="ltr">
                        📞 تماس
                      </a>
                    )}
                    <Link className="btn btn-ghost" href={`/business/${b.id}`}>
                      پروفایل
                    </Link>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
