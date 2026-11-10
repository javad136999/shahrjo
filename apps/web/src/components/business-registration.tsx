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
  getPlans,
  getProfile,
  getTokens,
  uploadBusinessImage,
  verifyBazaarPurchase,
} from '@/lib/api';
import { purchaseWithBazaar } from '@/lib/bazaar';
import { isMapCoordinateInCity, normalizeCityBoundary } from '@/lib/map-boundary';
import { thumbFallback, thumbUrlFor } from '@/lib/format';
import type { BusinessCategoryOption, City, CityMapData, PlanItem } from '@/lib/types';

const formatRial = (rial: number) => `${new Intl.NumberFormat('fa-IR').format(rial)} ریال`;
const planDurationMonths = (days: number) => days === 365 ? 12 : days >= 30 && days % 30 === 0 ? days / 30 : null;
const formatPlanDuration = (days: number) => {
  const months = planDurationMonths(days);
  return months ? `${months.toLocaleString('fa-IR')} ماهه` : `${days.toLocaleString('fa-IR')} روزه`;
};
const TIER_ICON: Record<string, string> = { GOLD: '👑', SILVER: '🥈', FREE: '⭐' };
const TIER_LABEL: Record<PlanItem['tier'], string> = { GOLD: 'اشتراک طلایی', SILVER: 'اشتراک نقره‌ای', FREE: 'اشتراک رایگان' };
const TIER_BENEFITS: Partial<Record<PlanItem['tier'], { icon: string; text: string; instagram?: boolean }[]>> = {
  GOLD: [
    { icon: '✨', text: 'ثبت کسب‌وکار در ویترین طلایی' },
    { icon: '📣', text: 'پیام تبلیغاتی ویژه در دیوار شهر به‌صورت روزانه' },
    { icon: '🎬', text: 'ساخت کلیپ تبلیغاتی از کسب‌وکار و انتشار در صفحهٔ شهرجو به آدرس shahrju.ir' },
    { icon: '📸', text: 'معرفی و بازدید از پیج اینستاگرام شهرجو', instagram: true },
  ],
  SILVER: [
    { icon: '📍', text: 'ثبت کسب‌وکار روی نقشه' },
    { icon: '🛍️', text: 'منو و محصولات کسب‌وکار' },
    { icon: '🎬', text: 'ساخت کلیپ تبلیغاتی و انتشار در پیج اینستاگرام شهرجو', instagram: true },
  ],
};

/**
 * The signup list leads with the practical service trades people most often
 * search for — electrician, plumbing, appliance repair, cleaning and home
 * maintenance — then falls back to familiar shops and venues. Matched by slug
 * first, with the seeded name as a fallback.
 */
const POPULAR_CATEGORY_SLUGS = [
  'electrician',
  'plumbing',
  'ac_service',
  'heating_service',
  'appliance_repair',
  'cleaning_service',
  'cabinet_shop',
  'masonry',
  'construction_contractor',
  'car_service',
  'repair',
  'phone_repair',
  'moving_company',
  'tailor',
  'beauty',
  'cafe',
  'restaurant',
  'bakery',
  'real_estate',
  'car_dealer',
  'shop',
];
const POPULAR_CATEGORY_NAMES = ['برق‌کاری', 'لوله‌کشی و تاسیسات', 'نصب و سرویس کولر', 'سرویس پکیج و شوفاژ', 'تعمیر لوازم خانگی', 'نظافت منزل و محل کار'];

const popularRank = (c: BusinessCategoryOption): number => {
  const bySlug = POPULAR_CATEGORY_SLUGS.indexOf(c.slug ?? '');
  if (bySlug >= 0) return bySlug;
  const byName = POPULAR_CATEGORY_NAMES.findIndex((n) => (c.name ?? '').trim() === n);
  return byName >= 0 ? byName : POPULAR_CATEGORY_SLUGS.length;
};

const popularFirst = (list: BusinessCategoryOption[]): BusinessCategoryOption[] =>
  [...list].sort((a, b) => popularRank(a) - popularRank(b));

function SearchableBusinessCategory({
  categories,
  value,
  onChange,
}: {
  categories: BusinessCategoryOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = categories.find((category) => String(category.id) === value);
  const normalizedQuery = query.trim().toLocaleLowerCase('fa-IR').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک');
  const filtered = categories.filter((category) => {
    const label = `${category.icon ?? ''} ${category.name}`.toLocaleLowerCase('fa-IR').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک');
    return label.includes(normalizedQuery);
  });

  return (
    <div className="biz-category-picker" data-testid="biz-category-picker">
      <button
        id="biz-cat"
        type="button"
        className="biz-category-picker__trigger"
        role="combobox"
        aria-label="دسته‌بندی"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="biz-category-options"
        aria-required="true"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <span>{selected ? `${selected.icon ? `${selected.icon} ` : ''}${selected.name}` : '— جستجو و انتخاب دسته‌بندی —'}</span>
        <span aria-hidden="true" className="biz-category-picker__chevron">⌄</span>
      </button>
      {open && (
        <div className="biz-category-picker__menu" data-testid="biz-category-menu">
          <input
            autoFocus
            type="search"
            className="biz-category-picker__search"
            placeholder="نام دسته‌بندی را جستجو کن…"
            aria-label="جستجوی دسته‌بندی کسب‌وکار"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
            }}
          />
          <div id="biz-category-options" className="biz-category-picker__options" role="listbox" aria-label="دسته‌بندی‌های کسب‌وکار">
            {filtered.length ? filtered.map((category) => (
              <button
                key={category.id}
                type="button"
                role="option"
                aria-selected={String(category.id) === value}
                data-category-id={category.id}
                className="biz-category-picker__option"
                onClick={() => {
                  onChange(String(category.id));
                  setQuery('');
                  setOpen(false);
                }}
              >
                <span aria-hidden="true">{category.icon || '🏪'}</span>
                <span>{category.name}</span>
                {String(category.id) === value && <span className="biz-category-picker__check" aria-hidden="true">✓</span>}
              </button>
            )) : <p className="biz-category-picker__empty">دسته‌بندی پیدا نشد.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Single-page business registration: details, optional map pin, and a plan are
 * visible together. The map is loaded only when requested. On confirm it creates the business (PENDING
 * + FREE), then starts a Cafe Bazaar checkout bound to that business. The
 * Android bridge opens Poolakey. A verified payment applies the paid tier AND
 * approves the still-PENDING business server-side — there is no admin step
 * for a paid signup (an explicit earlier admin rejection is still respected).
 */
export function BusinessRegistration() {
  const router = useRouter();
  const [categories, setCategories] = useState<BusinessCategoryOption[] | null>(null);
  const [plans, setPlans] = useState<PlanItem[] | null>(null);
  const [mapData, setMapData] = useState<CityMapData | null>(null);
  const [mapCityName, setMapCityName] = useState<string | null>(null);
  const [mapCitySlug, setMapCitySlug] = useState<string | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

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
  const [paymentNeedsRecovery, setPaymentNeedsRecovery] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  // Leaflet refs kept out of React state so clicks don't re-init the map.
  const logoInput = useRef<HTMLInputElement | null>(null);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<import('leaflet').Map | null>(null);
  const markerObj = useRef<import('leaflet').Marker | null>(null);
  const boundaryObj = useRef<import('leaflet').GeoJSON | null>(null);
  const Lref = useRef<typeof import('leaflet') | null>(null);
  const frameMapRef = useRef<(() => void) | null>(null);
  const mapDataRef = useRef<CityMapData | null>(null);
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Load form options and the exact profile city together; geometry is lazy.
  useEffect(() => {
    if (!getTokens()) {
      router.replace('/login?next=/business/new');
      return;
    }
    let alive = true;
    (async () => {
      try {
        const [cats, pls, me, cities] = await Promise.all([
          getBusinessCategories(),
          getPlans(),
          getProfile(),
          api.get<City[]>('/cities'),
        ]);
        if (!alive) return;
        setCategories(popularFirst(cats));
        setPlans(pls);
        if (!me.cityId) {
          setMapStatus('unavailable');
          setLocationError('برای ثبت کسب‌وکار، ابتدا شهر حساب کاربری‌ات را در پروفایل انتخاب کن.');
          return;
        }
        // The API always writes under the authenticated PROFILE city. Never
        // silently use localStorage, which can name a different city.
        const profileCity = cities.find((city) => city.id === me.cityId);
        if (!profileCity) {
          setMapStatus('unavailable');
          setLocationError('شهر ثبت‌شده در پروفایل پیدا نشد؛ شهر حساب را دوباره انتخاب کن.');
          return;
        }
        setMapCityName(profileCity.name);
        setMapCitySlug(profileCity.slug);
      } catch {
        if (alive) {
          setError('بارگذاری اطلاعات ثبت کسب‌وکار ممکن نشد؛ دوباره تلاش کن.');
          setMapStatus('unavailable');
          setLocationError('اطلاعات شهر حساب کاربری بارگذاری نشد؛ دوباره تلاش کن.');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  // Fetch city geometry only if the user opens the optional location picker.
  useEffect(() => {
    if (!locationOpen || !mapCitySlug || mapData) return;
    let alive = true;
    setMapStatus('loading');
    getCityMap(mapCitySlug).then((data) => {
      if (!alive) return;
      setMapData(data);
      const hasGeo = normalizeCityBoundary(data.city.boundary) !== null ||
        (data.city.latitude !== null && data.city.longitude !== null);
      setMapStatus(hasGeo ? 'ready' : 'unavailable');
      setLocationError(hasGeo ? null : 'محدودهٔ جغرافیایی این شهر هنوز تنظیم نشده است؛ موقعیت روی نقشه در دسترس نیست.');
    }).catch(() => {
      if (!alive) return;
      setMapStatus('unavailable');
      setLocationError('نقشهٔ شهر حساب بارگذاری نشد؛ می‌توانی بدون موقعیت ادامه بدهی.');
    });
    return () => {
      alive = false;
    };
  }, [locationOpen, mapCitySlug, mapData]);

  // Latest framing data for the picker (read by the one-time map instance).
  useEffect(() => {
    mapDataRef.current = mapData;
    if (mapReady) frameMapRef.current?.();
  }, [mapData, mapReady]);

  /**
   * Leaflet picker — initialise only after the user opens it and city geometry
   * is ready, so the main registration page does not wait for map assets.
   */
  useEffect(() => {
    if (!locationOpen || mapStatus !== 'ready') return;
    const container = mapEl.current;
    if (!container) return;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    const fitCity = () => {
      const map = mapObj.current;
      const L = Lref.current;
      if (!map || !L) return;
      // The location panel's final size settles after first paint — measure first,
      // otherwise the canvas keeps a stale size and its tiles stay grey.
      map.invalidateSize({ animate: false });
      boundaryObj.current?.remove();
      boundaryObj.current = null;

      const city = mapDataRef.current?.city;
      const lat = city?.latitude;
      const lng = city?.longitude;
      const boundary = normalizeCityBoundary(city?.boundary);
      if (city && boundary) {
        try {
          const layer = L.geoJSON(boundary as never, {
            style: { color: '#c9971f', weight: 2, fillColor: '#f2c94c', fillOpacity: 0.08, dashArray: '6 5' },
          }).addTo(map);
          boundaryObj.current = layer;
          const bounds = layer.getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [20, 20] });
            if (typeof map.setMaxBounds === 'function') map.setMaxBounds(bounds.pad(0.08));
            const selected = locationRef.current;
            if (selected && isMapCoordinateInCity(city, selected.lat, selected.lng)) {
              map.setView([selected.lat, selected.lng], 16, { animate: false });
            }
            return;
          }
        } catch {
          /* degenerate bounds — keep the centre view */
        }
      }
      if (!city || typeof lat !== 'number' || typeof lng !== 'number') {
        map.setView([30, 52], 6);
        return;
      }
      if (typeof map.setMaxBounds === 'function') {
        map.setMaxBounds([[lat - 0.15, lng - 0.15], [lat + 0.15, lng + 0.15]]);
      }
      const selected = locationRef.current;
      if (selected && isMapCoordinateInCity(city, selected.lat, selected.lng)) {
        map.setView([selected.lat, selected.lng], 16, { animate: false });
        return;
      }
      map.setView([lat, lng], 13);
    };
    frameMapRef.current = fitCity;

    (async () => {
      const L = await import('leaflet');
      if (disposed || !mapEl.current || mapObj.current) return;
      Lref.current = L;

      const map = L.map(mapEl.current);
      mapObj.current = map;
      map.setView([30, 52], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const rounded = (value: number) => Math.round(value * 1e6) / 1e6;
      const makePin = (lat: number, lng: number) => {
        const marker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'business-location-marker',
            html: '<span aria-hidden="true">📍</span>',
            iconSize: [42, 42],
            iconAnchor: [21, 38],
          }),
          draggable: true,
          title: 'موقعیت کسب‌وکار؛ برای اصلاح نشانگر را بکشید',
        }).addTo(map);
        marker.on('dragend', () => {
          const point = marker.getLatLng();
          const next = { lat: rounded(point.lat), lng: rounded(point.lng) };
          const city = mapDataRef.current?.city;
          if (!city || !isMapCoordinateInCity(city, next.lat, next.lng)) {
            setLocationError('نشانگر باید داخل محدودهٔ شهر باشد؛ موقعیت قبلی حفظ شد.');
            const previous = locationRef.current;
            if (previous) marker.setLatLng([previous.lat, previous.lng]);
            return;
          }
          locationRef.current = next;
          setLocation(next);
          setLocationError(null);
        });
        return marker;
      };

      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        const next = { lat: rounded(e.latlng.lat), lng: rounded(e.latlng.lng) };
        const city = mapDataRef.current?.city;
        if (!city || !isMapCoordinateInCity(city, next.lat, next.lng)) {
          setLocationError('برای انتخاب موقعیت، داخل محدودهٔ مشخص‌شدهٔ شهر را لمس کن.');
          return;
        }
        locationRef.current = next;
        setLocation(next);
        setLocationError(null);
        if (markerObj.current) markerObj.current.setLatLng([next.lat, next.lng]);
        else markerObj.current = makePin(next.lat, next.lng);
      });

      if (location) {
        locationRef.current = location;
        markerObj.current = makePin(location.lat, location.lng);
      }
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
    // `location` is read once when the optional picker opens; handlers own it after.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once per picker open
  }, [locationOpen, mapStatus]);

  const clearLocation = () => {
    setLocation(null);
    locationRef.current = null;
    markerObj.current?.remove();
    markerObj.current = null;
  };

  const locateCurrentPosition = () => {
    if (!navigator.geolocation) {
      setLocationError('امکان دریافت موقعیت در این مرورگر وجود ندارد؛ روی نقشه محل کسب‌وکار را انتخاب کن.');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const next = {
          lat: Math.round(position.coords.latitude * 1e6) / 1e6,
          lng: Math.round(position.coords.longitude * 1e6) / 1e6,
        };
        const city = mapDataRef.current?.city;
        if (!city || !isMapCoordinateInCity(city, next.lat, next.lng)) {
          setLocationError('موقعیت فعلی بیرون از محدودهٔ شهر ثبت‌شده است؛ محل کسب‌وکار را با لمس نقشه انتخاب کن.');
          return;
        }
        const map = mapObj.current;
        const L = Lref.current;
        if (!map || !L) {
          setLocationError('نقشه هنوز آماده نیست؛ چند لحظهٔ دیگر دوباره تلاش کن.');
          return;
        }
        map.fire('click', { latlng: L.latLng(next.lat, next.lng) });
        map.setView([next.lat, next.lng], Math.max(map.getZoom(), 16), { animate: true });
      },
      () => {
        setLocating(false);
        setLocationError('موقعیت دریافت نشد؛ دسترسی مکان‌یابی را بررسی کن یا محل را با لمس نقشه انتخاب کن.');
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
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
    if (!detailsValid) {
      setError('نام کسب‌وکار و دسته‌بندی را کامل کن.');
      return;
    }
    if (logoBusy) {
      setError('بارگذاری عکس کسب‌وکار هنوز کامل نشده است.');
      return;
    }
    if (!selectedPlanId) {
      setError('یک پلن اشتراک را انتخاب کن.');
      return;
    }
    if (!mapCityName) {
      setError(locationError ?? 'ابتدا شهر حساب کاربری‌ات را در پروفایل انتخاب کن.');
      return;
    }
    // Bazaar billing is provided by the Android APK bridge, not a normal browser.
    // Check before creating a business so a browser attempt cannot leave a duplicate PENDING row.
    if (typeof window === 'undefined' || !window.ShahrjoBazaar) {
      setError('پرداخت اشتراک بازار فقط داخل اپلیکیشن اندروید شهرجو نصب‌شده از بازار امکان‌پذیر است. برنامه را از بازار باز کنید و ثبت کسب‌وکار را آنجا انجام دهید.');
      return;
    }
    setBusy(true);
    setError(null);
    setPaymentNeedsRecovery(false);
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
      let result: Awaited<ReturnType<typeof verifyBazaarPurchase>>;
      try {
        result = await verifyBazaarPurchase({ paymentId: session.paymentId, productId: session.productId, purchaseToken });
      } catch (verificationError) {
        setPaymentNeedsRecovery(true);
        throw verificationError;
      }
      if (result !== 'SUCCESS' && result !== 'ALREADY_PAID') throw new Error('پرداخت بازار تأیید نشد.');
      router.replace(`/plans/result?status=${encodeURIComponent(result)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت کسب‌وکار؛ دوباره تلاش کنید');
      setBusy(false);
    }
  };

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
      <nav className="biz-registration__quick-nav" aria-label="بخش‌های ثبت کسب‌وکار">
        <a href="#biz-details">۱. مشخصات</a>
        <a href="#biz-location">۲. موقعیت اختیاری</a>
        <a href="#biz-plan">۳. اشتراک</a>
      </nav>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
          {paymentNeedsRecovery && (
            <div className="auth-actions">
              <p>اگر پرداخت در بازار انجام شده، دوباره پرداخت نکن؛ خرید قبلی را بازیابی کن.</p>
              <button type="button" className="btn btn-primary" onClick={() => router.replace('/plans')}>
                رفتن به بازیابی پرداخت قبلی
              </button>
            </div>
          )}
        </div>
      )}

      <form
        className="biz-registration__form"
        onSubmit={(event) => {
          event.preventDefault();
          void confirmAndPay();
        }}
      >
      <section className="ad-form biz-registration__step-panel" id="biz-details" aria-labelledby="biz-details-heading">
          <div className="biz-registration__section-heading">
            <span>۱</span><div><h2 id="biz-details-heading">مشخصات کسب‌وکار</h2><p>اطلاعات اصلی که در صفحه کسب‌وکار نمایش داده می‌شود.</p></div>
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
          <SearchableBusinessCategory categories={categories ?? []} value={categoryId} onChange={setCategoryId} />

          </div>
          <div className="biz-registration__field biz-registration__field--wide">
          <label htmlFor="biz-logo">عکس کسب‌وکار — اختیاری</label>
          <div className="biz-image">
            {/* A real button opens the picker. The bare <input type="file"> it
                replaced looked like a broken control (and did nothing inside
                the Android WebView), so the photo could not be uploaded. */}
            <button
              type="button"
              className="biz-image__picker"
              data-testid="biz-logo-pick"
              aria-label={logoUrl ? 'تغییر عکس کسب‌وکار' : 'انتخاب عکس کسب‌وکار'}
              disabled={logoBusy}
              onClick={() => logoInput.current?.click()}
            >
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
              <span className="biz-image__cta">{logoBusy ? 'در حال بارگذاری…' : logoUrl ? 'تغییر عکس' : 'انتخاب عکس'}</span>
            </button>
            <input
              id="biz-logo"
              ref={logoInput}
              className="biz-image__input"
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

      </section>

      <section className="biz-registration__step-panel" id="biz-location" aria-labelledby="biz-location-heading">
          <div className="biz-registration__section-heading">
            <span>۲</span><div><h2 id="biz-location-heading">موقعیت کسب‌وکار — اختیاری</h2><p>اگر موقعیت را اضافه کنی، مشتری‌ها راحت‌تر پیدایت می‌کنند؛ ثبت بدون نقشه هم ممکن است.</p></div>
          </div>
          <p className="muted small biz-location-instructions">
            شهر ثبت: <strong>{mapCityName ?? 'شهر حساب کاربری'}</strong>. لازم نیست بین صفحه‌ها جابه‌جا شوی؛ اگر می‌خواهی، نقشه را همین‌جا باز کن.
          </p>
          {!mapCityName && locationError && <p className="banner banner--error" role="alert">{locationError}</p>}
          <button
            type="button"
            className="btn btn-ghost biz-registration__location-toggle"
            aria-expanded={locationOpen}
            aria-controls="biz-location-picker"
            onClick={() => setLocationOpen((open) => !open)}
          >
            {locationOpen ? 'بستن نقشه' : location ? 'ویرایش موقعیت روی نقشه' : 'افزودن موقعیت روی نقشه (اختیاری)'}
          </button>
          {locationOpen && (
            <div id="biz-location-picker" className="biz-registration__location-picker">
              {mapStatus === 'loading' && (
                <div className="biz-map-placeholder" role="status" aria-live="polite">
                  <span className="biz-map-placeholder__pin" aria-hidden="true">📍</span>
                  <span>در حال آماده‌سازی نقشهٔ {mapCityName ?? 'شهر حساب کاربری'}…</span>
                </div>
              )}
              {mapStatus === 'unavailable' && locationError && mapCityName && <p className="banner banner--error" role="alert">{locationError}</p>}
              {mapStatus === 'ready' && (
                <>
                  <div className="biz-map-toolbar">
                    <span className="biz-map-toolbar__hint">برای ثبت محل، روی نقشه بزن یا نشانگر را جابه‌جا کن</span>
                    <div className="biz-map-toolbar__actions">
                      <button type="button" className="btn btn-ghost biz-map-toolbar__button" onClick={locateCurrentPosition} disabled={locating}>
                        {locating ? 'در حال یافتن…' : 'موقعیت فعلی من'}
                      </button>
                      <button type="button" className="btn btn-ghost biz-map-toolbar__button" onClick={() => frameMapRef.current?.()}>
                        نمایش محدودهٔ شهر
                      </button>
                    </div>
                  </div>
                  <div ref={mapEl} className="biz-map" role="application" aria-label={`انتخاب موقعیت کسب‌وکار در ${mapCityName ?? 'شهر حساب کاربری'}`} aria-disabled="false" data-testid="biz-map" />
                </>
              )}
              {locationError && mapStatus === 'ready' && <p className="banner banner--error" role="alert">{locationError}</p>}
              {location ? (
                <p className="chip chip--ok">
                  سنجاق روی مختصات {location.lat.toFixed(5)}, {location.lng.toFixed(5)} قرار دارد؛ برای جابه‌جایی آن را بکش.
                </p>
              ) : mapStatus === 'ready' ? (
                <p className="chip chip--muted">هنوز موقعیتی انتخاب نشده؛ روی نقشه لمس کن.</p>
              ) : null}
              {location && (
                <button type="button" className="btn btn-ghost" onClick={clearLocation}>
                  حذف موقعیت
                </button>
              )}
            </div>
          )}
        </section>

      <section className="biz-registration__step-panel" id="biz-plan" aria-labelledby="biz-plan-heading">
          <div className="biz-registration__section-heading">
            <span>۳</span><div><h2 id="biz-plan-heading">انتخاب اشتراک</h2><p>طرح مناسب کسب‌وکارت را انتخاب کن؛ مبلغ و مدت هر طرح را همین‌جا می‌بینی.</p></div>
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
            <section className="biz-registration__subscription-card" data-testid="biz-plans" aria-label="انتخاب پلن کسب‌وکار">
              {(['GOLD', 'SILVER', 'FREE'] as const).map((tier) => {
                const tierPlans = plans.filter((plan) => plan.tier === tier);
                if (tierPlans.length === 0) return null;
                const benefits = TIER_BENEFITS[tier];
                const titleId = `biz-tier-title-${tier.toLowerCase()}`;
                return (
                  <section
                    key={tier}
                    className={`biz-registration__tier-section biz-registration__tier-section--${tier.toLowerCase()}`}
                    data-testid={`biz-tier-${tier.toLowerCase()}`}
                    aria-labelledby={titleId}
                  >
                    <header className="biz-registration__tier-heading">
                      <span className="biz-registration__tier-icon" aria-hidden>{TIER_ICON[tier]}</span>
                      <div>
                        <h3 id={titleId}>{TIER_LABEL[tier]}</h3>
                        <p>{tier === 'GOLD' ? 'بیشترین دیده‌شدن برای کسب‌وکارت' : tier === 'SILVER' ? 'حضور حرفه‌ای روی نقشه و معرفی محصولات' : 'شروع رایگان برای معرفی کسب‌وکار'}</p>
                      </div>
                    </header>
                    <div className="plans-grid biz-registration__plans-grid">
                      {tierPlans.map((plan) => (
                        <article
                          key={plan.id}
                          className={`plan-card plan-card--${plan.tier.toLowerCase()} biz-registration__plan${(planDurationMonths(plan.durationDays) ?? 0) >= 6 ? ' biz-registration__plan--long' : ''}${selectedPlanId === plan.id ? ' is-selected' : ''}`}
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
                          {(planDurationMonths(plan.durationDays) ?? 0) >= 6 && (
                            <div className="biz-registration__plan-monthly" data-testid={`biz-plan-monthly-${plan.id}`}>
                              میانگین ماهانه: {formatRial(Math.round(plan.price / (planDurationMonths(plan.durationDays) ?? 1)))}
                            </div>
                          )}
                          <p className="biz-registration__plan-note">
                            {plan.tier === 'GOLD' ? 'بالاترین سطح اشتراک' : plan.tier === 'SILVER' ? 'اشتراک ویژه کسب‌وکار' : 'طرح رایگان'}
                          </p>
                          {selectedPlanId === plan.id && <span className="biz-registration__selected">✓ انتخاب شما</span>}
                        </article>
                      ))}
                    </div>
                    {benefits && (
                      <div className="biz-registration__tier-benefits" data-testid={`biz-benefits-${tier.toLowerCase()}`}>
                        <h4>مزایای اشتراک {tier === 'GOLD' ? 'طلایی' : 'نقره‌ای'}</h4>
                        <ul>
                          {benefits.map((benefit) => (
                            <li key={benefit.text}>
                              <span className="biz-registration__benefit-icon" aria-hidden>{benefit.icon}</span>
                              <span>
                                {benefit.text}
                                {benefit.instagram && (
                                  <> {' '}<a href="https://www.instagram.com/shahrju.ir/" target="_blank" rel="noopener noreferrer">@shahrju.ir</a></>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                );
              })}
            </section>
          )}
          <div className="auth-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!detailsValid || !mapCityName || !selectedPlanId || busy || logoBusy}
            >
              {busy ? 'در حال ثبت…' : 'تأیید و پرداخت'}
            </button>
          </div>
        </section>
      </form>
    </section>
  );
}
