'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import 'leaflet/dist/leaflet.css';
import {
  ApiError,
  checkoutPlan,
  createBusiness,
  getBusinessCategories,
  getCityMap,
  getLocalCity,
  getPlans,
  getTokens,
} from '@/lib/api';
import type { BusinessCategoryOption, CityMapData, PlanItem } from '@/lib/types';

const formatRial = (rial: number) => `${new Intl.NumberFormat('fa-IR').format(rial)} ریال`;
const TIER_ICON: Record<string, string> = { GOLD: '👑', SILVER: '🥈', FREE: '⭐' };

type Step = 1 | 2 | 3;

/**
 * Three-step business registration: details → pin location on the city map →
 * pick a Gold/Silver plan and pay. On confirm it creates the business (PENDING
 * + FREE), then starts a ZarinPal checkout bound to that business; the browser
 * is redirected to the gateway. The paid tier is applied server-side after a
 * verified payment (and admin review for business-bound plans).
 */
export function BusinessRegistration() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [categories, setCategories] = useState<BusinessCategoryOption[] | null>(null);
  const [plans, setPlans] = useState<PlanItem[] | null>(null);
  const [mapData, setMapData] = useState<CityMapData | null>(null);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Leaflet refs kept out of React state so clicks don't re-init the map.
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
        setCategories(cats);
        setPlans(pls);
        const city = getLocalCity();
        if (city) {
          try {
            setMapData(await getCityMap(city.slug));
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

  const confirmAndPay = async () => {
    if (!selectedPlanId) return;
    setBusy(true);
    setError(null);
    try {
      const biz = await createBusiness({
        name: name.trim(),
        categoryId: Number(categoryId),
        description: description.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        latitude: location?.lat,
        longitude: location?.lng,
      });
      const session = await checkoutPlan({ planId: selectedPlanId, businessId: biz.id });
      window.location.href = session.payUrl; // → ZarinPal gateway
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'خطا در ثبت کسب‌وکار؛ دوباره تلاش کنید');
      setBusy(false);
    }
  };

  const steps: { n: Step; label: string }[] = [
    { n: 1, label: 'مشخصات' },
    { n: 2, label: 'موقعیت' },
    { n: 3, label: 'اشتراک' },
  ];

  return (
    <section className="form-card" data-testid="business-registration">
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
          className="ad-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (detailsValid) setStep(2);
          }}
          noValidate
        >
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

          <label htmlFor="biz-desc">توضیحات — اختیاری</label>
          <textarea
            id="biz-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
          />

          <label htmlFor="biz-phone">شماره تماس — اختیاری</label>
          <input id="biz-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} inputMode="tel" />

          <label htmlFor="biz-addr">آدرس — اختیاری</label>
          <input id="biz-addr" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />

          <button className="btn btn-primary" type="submit" disabled={!detailsValid}>
            مرحله بعد: موقعیت روی نقشه
          </button>
        </form>
      )}

      {step === 2 && (
        <div>
          <p className="muted">روی نقشه شهر، موقعیت کسب‌وکارت را با یک کلیک مشخص کن (اختیاری است).</p>
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
        <div>
          <p className="muted">
            اشتراک کسب‌وکارت را انتخاب کن. با «تأیید و پرداخت»، کسب‌وکارت ثبت و به درگاه زرین‌پال منتقل می‌شوی.
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
                  className={`plan-card plan-card--${plan.tier.toLowerCase()}`}
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
                  style={{
                    cursor: 'pointer',
                    outline: selectedPlanId === plan.id ? '2px solid #c9971f' : undefined,
                  }}
                  data-testid={`biz-plan-${plan.id}`}
                >
                  <div className="plan-card__tier">
                    <span aria-hidden>{TIER_ICON[plan.tier] ?? '⭐'}</span> {plan.label}
                  </div>
                  <div className="plan-card__duration">{plan.durationDays} روز</div>
                  <div className="plan-card__price">{formatRial(plan.price)}</div>
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
