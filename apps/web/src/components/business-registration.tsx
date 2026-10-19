'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import 'leaflet/dist/leaflet.css';
import {
  ApiError,
  checkoutPlan,
  createBusiness,
  getBusinessCategories,
  api,
  getCityMap,
  getLocalCity,
  getPlans,
  getProfile,
  getTokens,
  uploadBusinessImage,
  verifyBazaarPurchase,
} from '@/lib/api';
import { purchaseWithBazaar } from '@/lib/bazaar';
import { thumbFallback, thumbUrlFor } from '@/lib/format';
import type { BusinessCategoryOption, City, CityMapData, PlanItem } from '@/lib/types';

const formatRial = (rial: number) => `${new Intl.NumberFormat('fa-IR').format(rial)} ریال`;
const formatPlanDuration = (days: number) => days >= 30 && days % 30 === 0 ? `${(days / 30).toLocaleString('fa-IR')} ماهه` : `${days.toLocaleString('fa-IR')} روزه`;
const TIER_ICON: Record<string, string> = { GOLD: '👑', SILVER: '🥈', FREE: '⭐' };

/**
 * The signup list leads with the trades people actually look for in a city —
 * café/restaurant, bakery, real-estate agency, car gallery and shops — in that
 * order; every other trade follows in the order the API returned (Array#sort
 * is stable). Matched by slug first, with the seeded name as a fallback.
 */
const POPULAR_CATEGORY_SLUGS = ['cafe', 'restaurant', 'bakery', 'real_estate', 'car_dealer', 'shop'];
const POPULAR_CATEGORY_NAMES = ['کافه', 'رستوران', 'نانوایی', 'املاک', 'اتوگالری', 'فروشگاه'];

const popularRank = (c: BusinessCategoryOption): number => {
  const bySlug = POPULAR_CATEGORY_SLUGS.indexOf(c.slug ?? '');
  if (bySlug >= 0) return bySlug;
  const byName = POPULAR_CATEGORY_NAMES.findIndex((n) => (c.name ?? '').trim() === n);
  return byName >= 0 ? byName : POPULAR_CATEGORY_SLUGS.length;
};

const popularFirst = (list: BusinessCategoryOption[]): BusinessCategoryOption[] =>
  [...list].sort((a, b) => popularRank(a) - popularRank(b));

type Step = 1 | 2 | 3;

/**
 * Three-step business registration: details → pin location on the city map →
 * pick a Gold/Silver plan and pay. On confirm it creates the business (PENDING
 * + FREE), then starts a Cafe Bazaar checkout bound to that business. The
 * Android bridge opens Poolakey. A verified payment applies the paid tier AND
 * approves the still-PENDING business server-side — there is no admin step
 * for a paid signup (an explicit earlier admin rejection is still respected).
 */
export function BusinessRegistration() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [categories, setCategories] = useState<BusinessCategoryOption[] | null>(null);
  const [plans, setPlans] = useState<PlanItem[] | null>(null);
  const [mapData, setMapData] = useState<CityMapData | null>(null);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Leaflet refs kept out of React state so clicks don't re-init the map.
  const logoInput = useRef<HTMLInputElement | null>(null);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<import('leaflet').Map | null>(null);
  const markerObj = useRef<import('leaflet').Marker | null>(null);
  const Lref = useRef<typeof import('leaflet') | null>(null);

  // Auth gate + load categories/plans (+ city map framing data).
  useEffect(() => {
    if (!getTokens()) {
      router.replace('/login?next=/business/new');
      return;
    }
    let alive = true;
    (async () => {
      try {
        const [cats, pls] = await Promise.all([getBusinessCategories(), getPlans()]);
        if (!alive) return;
        setCategories(popularFirst(cats));
        setPlans(pls);
        // The backend files the business under the PROFILE city — frame the
        // map there. localStorage can differ from the profile and used to let
        // a pin be dropped in a completely different city (cross-city coords).
        let slug = getLocalCity()?.slug ?? null;
        if (getTokens()) {
          try {
            const me = await getProfile();
            if (me.cityId) {
              const cities = await api.get<City[]>('/cities');
              slug = cities.find((c) => c.id === me.cityId)?.slug ?? slug;
            }
          } catch {
            // profile unavailable → keep the local fallback
          }
        }
        if (slug) {
          try {
            setMapData(await getCityMap(slug));
          } catch {
            // picker still works, framed on a broad default
          }
        }
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : 'خطا در بارگذاری اطلاعات');
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  // Leaflet picker — initialised once when the user reaches the location step.
  useEffect(() => {
    if (step !== 2) return;
    let disposed = false;
    (async () => {
      const L = await import('leaflet');
      if (disposed || !mapEl.current || mapObj.current) return;
      Lref.current = L;
      const city = mapData?.city;
      const center: [number, number] =
        city && city.latitude != null && city.longitude != null ? [city.latitude, city.longitude] : [30, 52];
      const map = L.map(mapEl.current);
      map.setView(center, 13);
      mapObj.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const b = city?.boundary as { type?: string; coordinates?: unknown } | null;
      if (b && (b.type === 'Polygon' || b.type === 'MultiPolygon')) {
        const layer = L.geoJSON(b as never, {
          style: { color: '#c9971f', weight: 2, fillColor: '#f2c94c', fillOpacity: 0.08, dashArray: '6 5' },
        }).addTo(map);
        try {
          map.fitBounds(layer.getBounds(), { padding: [20, 20] });
        } catch {
          /* degenerate bounds — keep the centre view */
        }
      }

      if (location) markerObj.current = L.marker([location.lat, location.lng]).addTo(map);
      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng;
        setLocation({ lat, lng });
        if (markerObj.current) markerObj.current.setLatLng([lat, lng]);
        else markerObj.current = L.marker([lat, lng]).addTo(map);
      });
    })();
    return () => {
      disposed = true;
      mapObj.current?.remove();
      mapObj.current = null;
      markerObj.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init only on entering step 2
  }, [step, mapData]);

  const clearLocation = () => {
    setLocation(null);
    markerObj.current?.remove();
    markerObj.current = null;
  };

  const detailsValid = name.trim().length >= 2 && categoryId !== '';

  /**
   * The business photo goes through `/uploads/business`, which encodes it with
   * the hard-compressed business profile server-side — the owner's camera-size
   * JPEG becomes a small WebP, so the disk keeps up with months of signups.
   */
  const pickLogo = async (file: File | null) => {
    if (!file) return;
    setLogoBusy(true);
    setError(null);
    try {
      const uploaded = await uploadBusinessImage(file);
      setLogoUrl(uploaded.url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'بارگذاری عکس کسب‌وکار ناموفق بود');
    } finally {
      setLogoBusy(false);
      if (logoInput.current) logoInput.current.value = '';
    }
  };

  const confirmAndPay = async () => {
    if (!selectedPlanId) return;
    // Bazaar billing is provided by the Android APK bridge, not a normal browser.
    // Check before creating a business so a browser attempt cannot leave a duplicate PENDING row.
    if (typeof window === 'undefined' || !window.ShahrjoBazaar) {
      setError('پرداخت اشتراک بازار فقط داخل اپلیکیشن اندروید شهرجو نصب‌شده از بازار امکان‌پذیر است. برنامه را از بازار باز کنید و ثبت کسب‌وکار را آنجا انجام دهید.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const biz = await createBusiness({
        name: name.trim(),
        categoryId: Number(categoryId),
        description: description.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        logoUrl: logoUrl || undefined,
        latitude: location?.lat,
        longitude: location?.lng,
      });
      const session = await checkoutPlan({ planId: selectedPlanId, businessId: biz.id });
      const purchaseToken = await purchaseWithBazaar(session.productId, session.packageName);
      const result = await verifyBazaarPurchase({ paymentId: session.paymentId, productId: session.productId, purchaseToken });
      if (result !== 'SUCCESS' && result !== 'ALREADY_PAID') throw new Error('پرداخت بازار تأیید نشد.');
      router.replace(`/plans/result?status=${encodeURIComponent(result)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت کسب‌وکار؛ دوباره تلاش کنید');
      setBusy(false);
    }
  };

  const steps: { n: Step; label: string }[] = [
    { n: 1, label: 'مشخصات' },
    { n: 2, label: 'موقعیت' },
    { n: 3, label: 'اشتراک' },
  ];

  return (
    <section className="form-card biz-registration--jam-style" data-testid="business-registration">
      <header className="biz-registration__hero">
        <span className="biz-registration__hero-icon" aria-hidden>🏪</span>
        <div>
          <p className="biz-registration__eyebrow">ویژه کسب‌وکارهای محلی</p>
          <h1>ثبت کسب‌وکار در شهرجو</h1>
          <p>مشخصات کسب‌وکارت را ثبت کن تا شهروندان راحت‌تر پیدایت کنند.</p>
        </div>
      </header>
      <div className="biz-registration__progress">
        <div className="biz-registration__progress-copy">
          <strong>{steps.find((s) => s.n === step)?.label}</strong>
          <span>مرحله {step.toLocaleString('fa-IR')} از ۳</span>
        </div>
        <div className="biz-registration__progress-track" aria-hidden>
          <span style={{ width: `${(step / 3) * 100}%` }} />
        </div>
      </div>
      <div className="biz-steps" aria-label="مراحل ثبت">
        {steps.map((s) => (
          <span
            key={s.n}
            className={`biz-steps__item${step === s.n ? ' is-active' : ''}${step > s.n ? ' is-done' : ''}`}
          >
            {step > s.n ? '✓' : s.n} {s.label}
          </span>
        ))}
      </div>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      {step === 1 && (
        <form
          className="ad-form biz-registration__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (detailsValid) setStep(2);
          }}
          noValidate
        >
          <div className="biz-registration__section-heading">
            <span>۱</span><div><h2>مشخصات کسب‌وکار</h2><p>اطلاعات اصلی که در صفحه کسب‌وکار نمایش داده می‌شود.</p></div>
          </div>
          <div className="biz-registration__fields">
          <div className="biz-registration__field biz-registration__field--wide">
          <label htmlFor="biz-name">نام کسب‌وکار</label>
          <input
            id="biz-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثلاً قهوه‌خانه مرکزی"
            minLength={2}
            maxLength={160}
            required
          />

          </div>
          <div className="biz-registration__field">
          <label htmlFor="biz-cat">دسته‌بندی</label>
          <select id="biz-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="">— انتخاب دسته‌بندی —</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </option>
            ))}
          </select>

          </div>
          <div className="biz-registration__field biz-registration__field--wide">
          <label htmlFor="biz-logo">عکس کسب‌وکار — اختیاری</label>
          <div className="biz-image">
            {logoUrl ? (
              <span className="biz-image__picked" data-testid="biz-logo-preview">
                {/* eslint-disable-next-line @next/next/no-img-element -- owner-uploaded media */}
                <img src={thumbUrlFor(logoUrl) ?? logoUrl} onError={thumbFallback(logoUrl)} alt="" />
              </span>
            ) : (
              <span className="biz-image__picked biz-image__picked--empty" aria-hidden>
                🏪
              </span>
            )}
            <input
              id="biz-logo"
              ref={logoInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              data-testid="biz-logo-input"
              onChange={(e) => void pickLogo(e.target.files?.[0] ?? null)}
            />
            {logoUrl && (
              <button
                type="button"
                className="btn btn-ghost"
                data-testid="biz-logo-remove"
                onClick={() => setLogoUrl('')}
              >
                حذف عکس
              </button>
            )}
          </div>
          <p className="muted small">
            {logoBusy
              ? 'در حال بارگذاری و فشرده‌سازی عکس…'
              : 'عکس فشرده ذخیره می‌شود و روی پین نقشه و در ویترین طلایی شهر (اگر اشتراک طلایی/نقره‌ای داشته باشی) جای آیکون نمایش داده می‌شود.'}
          </p>

          </div>
          <div className="biz-registration__field biz-registration__field--wide">
          <label htmlFor="biz-desc">توضیحات — اختیاری</label>
          <textarea
            id="biz-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
          />

          </div>
          <div className="biz-registration__field">
          <label htmlFor="biz-phone">شماره تماس — اختیاری</label>
          <input id="biz-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} inputMode="tel" />

          </div>
          <div className="biz-registration__field biz-registration__field--wide">
          <label htmlFor="biz-addr">آدرس — اختیاری</label>
          <input id="biz-addr" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} placeholder="خیابان، محله یا نشانی کسب‌وکار" />
          </div>
          </div>

          <button className="btn btn-primary biz-registration__next" type="submit" disabled={!detailsValid}>
            مرحله بعد: موقعیت
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="biz-registration__step-panel">
          <div className="biz-registration__section-heading">
            <span>۲</span><div><h2>موقعیت کسب‌وکار</h2><p>موقعیت روی نقشه اختیاری است و به مشتری‌ها کمک می‌کند راحت‌تر پیدایت کنند.</p></div>
          </div>
          <div ref={mapEl} className="biz-map" data-testid="biz-map" />
          {location ? (
            <p className="chip chip--ok">
              موقعیت انتخاب شد: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
          ) : (
            <p className="chip chip--muted">هنوز موقعیتی انتخاب نشده</p>
          )}
          <div className="auth-actions">
            <button className="btn btn-primary" onClick={() => setStep(3)}>
              مرحله بعد: اشتراک
            </button>
            {location && (
              <button className="btn btn-ghost" onClick={clearLocation}>
                حذف موقعیت
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              بازگشت
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="biz-registration__step-panel">
          <div className="biz-registration__section-heading">
            <span>۳</span><div><h2>انتخاب اشتراک</h2><p>طرح مناسب کسب‌وکارت را انتخاب کن؛ مبلغ و مدت هر طرح پیش از ادامه مشخص است.</p></div>
          </div>
          <p className="muted">
            اشتراک کسب‌وکارت را انتخاب کن. با «تأیید و پرداخت»، کسب‌وکارت ثبت و پرداخت درون‌برنامه‌ای بازار برایت باز می‌شود؛ بلافاصله پس از پرداخت موفق، اشتراک فعال و کسب‌وکارت تأیید می‌شود.
          </p>
          {!plans && !error && (
            <p className="loading muted" aria-busy>
              در حال بارگذاری پلن‌ها…
            </p>
          )}
          {plans && (
            <div className="plans-grid" data-testid="biz-plans">
              {plans.map((plan) => (
                <article
                  key={plan.id}
                  className={`plan-card plan-card--${plan.tier.toLowerCase()} biz-registration__plan${selectedPlanId === plan.id ? ' is-selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedPlanId === plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPlanId(plan.id);
                    }
                  }}
                  data-testid={`biz-plan-${plan.id}`}
                >
                  <div className="plan-card__tier">
                    <span aria-hidden>{TIER_ICON[plan.tier] ?? '⭐'}</span> {plan.label}
                  </div>
                  <div className="plan-card__duration">{formatPlanDuration(plan.durationDays)}</div>
                  <div className="plan-card__price">{formatRial(plan.price)}</div>
                  <p className="biz-registration__plan-note">
                    {plan.tier === 'GOLD' ? 'بالاترین سطح اشتراک' : plan.tier === 'SILVER' ? 'اشتراک ویژه کسب‌وکار' : 'طرح رایگان'}
                  </p>
                  {selectedPlanId === plan.id && <span className="biz-registration__selected">✓ انتخاب شما</span>}
                </article>
              ))}
            </div>
          )}
          <div className="auth-actions">
            <button className="btn btn-primary" disabled={!selectedPlanId || busy} onClick={confirmAndPay}>
              {busy ? 'در حال ثبت…' : 'تأیید و پرداخت'}
            </button>
            <button className="btn btn-ghost" onClick={() => setStep(2)} disabled={busy}>
              بازگشت
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
