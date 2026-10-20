'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import 'leaflet/dist/leaflet.css';
import {
  ApiError,
  adminCreateBusiness,
  api,
  getBusinessCategories,
  getCityMap,
  getTokens,
  uploadBusinessImage,
} from '@/lib/api';
import { thumbFallback, thumbUrlFor } from '@/lib/format';
import type { BusinessCategoryOption, City, CityMapData } from '@/lib/types';

/** Activation presets offered to the operator (months of the chosen tier). */
const MONTH_OPTIONS = [1, 3, 6, 12, 24];

/** Neutral view before a city is framed; city zoom is the town-level overview. */
const DEFAULT_CENTER: [number, number] = [30, 52];
const DEFAULT_ZOOM = 6;
const CITY_ZOOM = 12;

const TIER_OPTIONS: { value: '' | 'GOLD' | 'SILVER'; icon: string; label: string; hint: string }[] = [
  { value: '', icon: '🆓', label: 'رایگان', hint: 'بدون اشتراک؛ فقط انتشار' },
  { value: 'GOLD', icon: '👑', label: 'طلایی', hint: 'ویترین طلایی + اولویت نمایش' },
  { value: 'SILVER', icon: '🥈', label: 'نقره‌ای', hint: 'ویترین نقره‌ای + اولویت نمایش' },
];

/**
 * «ثبت دستی کسب‌وکار» — the operator's own signup screen (a separate page, not
 * a dialog): pick the city, drop the pin on THAT city's map, upload the photo,
 * choose GOLD/SILVER and for how many months it runs, then publish. No payment
 * and no moderation queue — the operator IS the approval step, and the chosen
 * period ends in the expiry sweep like any paid subscription.
 */
export function AdminBusinessCreate() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<BusinessCategoryOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: number; name: string; subscriptionTier: string; citySlug: string } | null>(null);

  // registration form
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [cityId, setCityId] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [tier, setTier] = useState<'' | 'GOLD' | 'SILVER'>('');
  const [months, setMonths] = useState(3);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);

  // Leaflet lives in refs so a click never re-initialises the map.
  const logoInput = useRef<HTMLInputElement | null>(null);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<import('leaflet').Map | null>(null);
  const markerObj = useRef<import('leaflet').Marker | null>(null);
  const boundaryObj = useRef<import('leaflet').GeoJSON | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const frameMapRef = useRef<(() => void) | null>(null);
  const mapDataRef = useRef<CityMapData | null>(null);
  const [mapData, setMapData] = useState<CityMapData | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // login gate + pickers
  useEffect(() => {
    if (!getTokens()) {
      router.replace('/login?next=/admin/business/new');
      return;
    }
    let alive = true;
    (async () => {
      try {
        const [cityRows, categoryRows] = await Promise.all([api.get<City[]>('/cities'), getBusinessCategories()]);
        if (!alive) return;
        setCities(cityRows);
        setCategories(categoryRows);
        setReady(true);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : 'دریافت فهرست شهرها/دسته‌بندی‌ها ممکن نشد');
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  // framing data for the chosen city (boundary → exact urban frame)
  useEffect(() => {
    if (!ready || !cityId) return;
    const city = cities.find((c) => c.id === Number(cityId));
    if (!city) return;
    let alive = true;
    (async () => {
      try {
        const data = await getCityMap(city.slug);
        if (alive) setMapData(data);
      } catch {
        // no framing data → the picker still opens on the default view
        if (alive) setMapData(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [ready, cityId, cities]);

  // Latest framing data for the selected city, read by the one-time picker.
  useEffect(() => {
    mapDataRef.current = mapData;
    if (mapReady) frameMapRef.current?.();
  }, [mapData, mapReady]);

  /**
   * The picker: ONE Leaflet instance per selected city, created when the card
   * mounts and framed again in place when the city's map data arrives. Tearing
   * the instance down on every data change (the old behaviour) flashed a grey
   * canvas and left the panes/zoom control misaligned — «نقشه محو می‌شود و
   * به‌هم می‌ریزد» while an operator was registering a business by hand.
   */
  useEffect(() => {
    if (!cityId || created) return;
    const container = mapEl.current;
    if (!container) return;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    // Even without the map payload the picker can open on the chosen town.
    const selectedCity = cities.find((c) => c.id === Number(cityId));

    const fitCity = () => {
      const map = mapObj.current;
      const L = leafletRef.current;
      if (!map || !L) return;
      // Measure the canvas before framing: the card settles after first paint,
      // and a stale size is what leaves the tiles grey and half-loaded.
      map.invalidateSize({ animate: false });
      boundaryObj.current?.remove();
      boundaryObj.current = null;

      const city = mapDataRef.current?.city;
      const lat = city?.latitude ?? selectedCity?.latitude;
      const lng = city?.longitude ?? selectedCity?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        return;
      }

      const boundary = city?.boundary as { type?: string } | null | undefined;
      if (boundary && (boundary.type === 'Polygon' || boundary.type === 'MultiPolygon')) {
        try {
          const layer = L.geoJSON(boundary as never, { style: () => ({ color: '#0e7a5f', weight: 1 }) }).addTo(map);
          boundaryObj.current = layer;
          const bounds = layer.getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [16, 16] });
            return;
          }
        } catch {
          // unparseable outline → fall back to the city centre
        }
      }
      map.setView([lat, lng], CITY_ZOOM);
    };
    frameMapRef.current = fitCity;

    (async () => {
      const L = await import('leaflet');
      if (disposed || !mapEl.current || mapObj.current) return;
      leafletRef.current = L;

      const map = L.map(mapEl.current);
      mapObj.current = map;
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        const lat = Math.round(e.latlng.lat * 1e6) / 1e6;
        const lng = Math.round(e.latlng.lng * 1e6) / 1e6;
        setPin({ lat, lng });
        if (markerObj.current) markerObj.current.setLatLng([lat, lng]);
        else markerObj.current = L.marker([lat, lng]).addTo(map);
      });

      fitCity();
      setMapReady(true);

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => mapObj.current?.invalidateSize({ animate: false }));
        resizeObserver.observe(mapEl.current);
      }
    })();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      markerObj.current?.remove();
      markerObj.current = null;
      boundaryObj.current?.remove();
      boundaryObj.current = null;
      frameMapRef.current = null;
      mapObj.current?.remove();
      mapObj.current = null;
      setMapReady(false);
    };
    // `created` re-mounts the form after «ثبت کسب‌وکار بعدی», so the picker has
    // to come back with it; the framing data is applied by the effect above.
  }, [cityId, created, cities]);

  /** Changing the city invalidates the old pin — it belonged to the old map. */
  const chooseCity = (value: string) => {
    setCityId(value);
    setPin(null);
    mapDataRef.current = null;
    setMapData(null);
  };

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2 || !categoryId || !cityId) {
      setError('نام، دسته‌بندی و شهر الزامی است');
      return;
    }
    if (!pin) {
      setError('موقعیت کسب‌وکار را روی نقشه انتخاب کن تا روی نقشهٔ شهر نمایش داده شود');
      return;
    }
    const selectedCity = cities.find((city) => city.id === Number(cityId));
    if (!selectedCity) {
      setError('شهر انتخاب‌شده معتبر نیست؛ دوباره انتخابش کن');
      return;
    }
    setBusy(true);
    try {
      const row = await adminCreateBusiness({
        name: name.trim(),
        categoryId: Number(categoryId),
        cityId: Number(cityId),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        description: description.trim() || undefined,
        ownerPhone: ownerPhone.trim() || undefined,
        logoUrl: logoUrl || undefined,
        latitude: pin.lat,
        longitude: pin.lng,
        tier: tier || undefined,
        months: tier ? months : undefined,
      });
      setCreated({ ...row, citySlug: selectedCity.slug });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ثبت کسب‌وکار ممکن نشد؛ دوباره تلاش کنید');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setCreated(null);
    setName('');
    setCategoryId('');
    setPhone('');
    setAddress('');
    setDescription('');
    setOwnerPhone('');
    setLogoUrl('');
    setTier('');
    setMonths(3);
    setPin(null);
    markerObj.current?.remove();
    markerObj.current = null;
    setError(null);
  };

  if (!ready && !error) {
    return (
      <div className="ad-page">
        <p className="loading muted" aria-busy>
          در حال آماده‌سازی فرم…
        </p>
      </div>
    );
  }

  if (created) {
    return (
      <div className="ad-page" data-testid="admin-create-done">
        <section className="result-card">
          <div className="result-card__icon" aria-hidden>
            ✅
          </div>
          <h1>کسب‌وکار منتشر شد</h1>
          <p>
            «{created.name}» همین حالا با وضعیت تأییدشده در جستجوی شهرش دیده می‌شود.
            {created.subscriptionTier !== 'FREE' && ` تیپ ${created.subscriptionTier === 'GOLD' ? 'طلایی' : 'نقره‌ای'} تا پایان مدت انتخابی فعال است.`}
          </p>
          <div className="result-card__actions">
            <Link href={`/city/${created.citySlug}#map`} className="btn btn-primary">
              مشاهده روی نقشهٔ شهر
            </Link>
            <Link href="/admin" className="btn btn-primary">
              بازگشت به پنل مدیریت
            </Link>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              ثبت کسب‌وکار بعدی
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="ad-page admin-newbiz" data-testid="admin-create-page">
      <Link href="/admin" className="back-link">
        ← پنل مدیریت
      </Link>

      <section className="plans-hero">
        <span className="icon-tile icon-tile--lg" aria-hidden>
          🏪
        </span>
        <div>
          <h1>ثبت دستی کسب‌وکار</h1>
          <p className="muted">
            بدون پرداخت و بدون صف — کسب‌وکار همین‌جا تأیید و منتشر می‌شود؛ اشتراک طلایی/نقره‌ای را خودت برای مدت دلخواه فعال کن.
          </p>
        </div>
      </section>

      {error && (
        <div className="banner banner--error" role="alert" data-testid="admin-create-error">
          <span>{error}</span>
        </div>
      )}

      <form className="ad-form admin-newbiz__form" onSubmit={submit} noValidate>
        {/* ---- 1) city first: everything else frames on it ---- */}
        <section className="form-card admin-newbiz__card">
          <h2 className="admin-newbiz__title">
            <span aria-hidden>🏙</span> شهر و دسته‌بندی
          </h2>
          <div className="biz-form__row">
            <div>
              <label htmlFor="nb-city">شهر *</label>
              <select id="nb-city" value={cityId} onChange={(e) => chooseCity(e.target.value)} required data-testid="nb-city">
                <option value="">— انتخاب شهر —</option>
                {cities.map((city) => (
                  <option key={city.id} value={String(city.id)}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nb-cat">دسته‌بندی *</label>
              <select id="nb-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required data-testid="nb-category">
                <option value="">— انتخاب دسته —</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.icon ? `${category.icon} ` : ''}
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="nb-owner">شمارهٔ مالک — اختیاری (خالی = خودِ مدیر)</label>
            <input
              id="nb-owner"
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              maxLength={15}
              inputMode="tel"
              data-testid="nb-owner"
            />
          </div>
        </section>

        {/* ---- 2) the listing itself ---- */}
        <section className="form-card admin-newbiz__card">
          <h2 className="admin-newbiz__title">
            <span aria-hidden>📝</span> مشخصات کسب‌وکار
          </h2>
          <label htmlFor="nb-name">نام کسب‌وکار *</label>
          <input
            id="nb-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={160}
            minLength={2}
            required
            data-testid="nb-name"
          />

          <label htmlFor="nb-phone">شماره تماس</label>
          <input id="nb-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} inputMode="tel" data-testid="nb-phone" />

          <label htmlFor="nb-address">آدرس</label>
          <input id="nb-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} data-testid="nb-address" />

          <label htmlFor="nb-desc">توضیحات</label>
          <textarea
            id="nb-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            data-testid="nb-description"
          />
        </section>

        {/* ---- 3) photo ---- */}
        <section className="form-card admin-newbiz__card">
          <h2 className="admin-newbiz__title">
            <span aria-hidden>🖼</span> عکس کسب‌وکار
          </h2>
          <div className="biz-image">
            {/* The thumbnail IS the upload button: a bare <input type="file">
                was easy to miss and does nothing in the Android WebView. */}
            <button
              type="button"
              className="biz-image__picker"
              data-testid="nb-logo-pick"
              aria-label={logoUrl ? 'تغییر عکس کسب‌وکار' : 'انتخاب عکس کسب‌وکار'}
              disabled={logoBusy}
              onClick={() => logoInput.current?.click()}
            >
              {logoUrl ? (
                <span className="biz-image__picked" data-testid="nb-logo-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element -- owner-uploaded media */}
                  <img src={thumbUrlFor(logoUrl) ?? logoUrl} onError={thumbFallback(logoUrl)} alt="" />
                </span>
              ) : (
                <span className="biz-image__picked biz-image__picked--empty" aria-hidden>
                  🏪
                </span>
              )}
              <span className="biz-image__cta">{logoBusy ? 'در حال بارگذاری…' : logoUrl ? 'تغییر عکس' : 'انتخاب عکس'}</span>
            </button>
            <input
              id="nb-logo"
              ref={logoInput}
              className="biz-image__input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              data-testid="nb-logo"
              onChange={(e) => void pickLogo(e.target.files?.[0] ?? null)}
            />
            {logoUrl && (
              <button type="button" className="btn btn-ghost" data-testid="nb-logo-remove" onClick={() => setLogoUrl('')}>
                حذف عکس
              </button>
            )}
          </div>
          <p className="muted small">
            {logoBusy ? 'در حال بارگذاری و فشرده‌سازی عکس…' : 'عکس‌ها فشرده ذخیره می‌شوند (WebP ≤۱۰۰۰px).'}
          </p>
        </section>

        {/* ---- 4) the pin, on the SELECTED city's map ---- */}
        <section className="form-card admin-newbiz__card">
          <h2 className="admin-newbiz__title">
            <span aria-hidden>📍</span> موقعیت روی نقشهٔ شهر
          </h2>
          {!cityId ? (
            <p className="muted small">اول شهر را انتخاب کن تا نقشهٔ همان شهر بیاید.</p>
          ) : (
            <>
              <div className="admin-newbiz__map" ref={mapEl} data-testid="nb-map" />
              <p className="muted small" data-testid="nb-pin">
                {pin ? `منتظر: ${pin.lat}، ${pin.lng} — با کلیک روی نقشه جابه‌جا می‌شود.` : 'روی نقشه کلیک کن تا موقعیت کسب‌وکار ثبت شود؛ برای نمایش روی نقشه الزامی است.'}
              </p>
            </>
          )}
        </section>

        {/* ---- 5) tier + duration ---- */}
        <section className="form-card admin-newbiz__card">
          <h2 className="admin-newbiz__title">
            <span aria-hidden>👑</span> اشتراک و مدت فعال‌سازی
          </h2>
          <div className="admin-newbiz__tiers" role="radiogroup" aria-label="نوع اشتراک">
            {TIER_OPTIONS.map((option) => (
              <label
                key={option.value || 'free'}
                className={`admin-newbiz__tier${tier === option.value ? ' is-active' : ''}`}
                data-testid={`nb-tier-${option.value || 'free'}`}
              >
                <input
                  type="radio"
                  name="nb-tier"
                  value={option.value}
                  checked={tier === option.value}
                  onChange={() => setTier(option.value)}
                />
                <span className="admin-newbiz__tier-icon" aria-hidden>
                  {option.icon}
                </span>
                <b>{option.label}</b>
                <small>{option.hint}</small>
              </label>
            ))}
          </div>

          {tier !== '' && (
            <div className="admin-newbiz__months">
              <label htmlFor="nb-months">مدت فعال‌سازی (ماه)</label>
              <select id="nb-months" value={String(months)} onChange={(e) => setMonths(Number(e.target.value))} data-testid="nb-months">
                {MONTH_OPTIONS.map((m) => (
                  <option key={m} value={String(m)}>
                    {m.toLocaleString('fa-IR')} ماه
                  </option>
                ))}
              </select>
              <p className="muted small">
                این {months.toLocaleString('fa-IR')} ماه از امروز فعال است؛ بعد از پایان، کسب‌وکار تعلیق می‌شود و از همین‌جا قابل تمدید است.
              </p>
            </div>
          )}

          <div className="auth-actions">
            <button type="submit" className="btn btn-primary" disabled={busy || logoBusy} data-testid="nb-submit">
              {busy ? 'در حال ثبت و انتشار…' : 'تأیید و انتشار کسب‌وکار'}
            </button>
            <Link href="/admin" className="btn btn-ghost">
              انصراف
            </Link>
          </div>
        </section>
      </form>
    </div>
  );
}
