'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  checkoutPlan,
  createBusiness,
  getBusinessCategories,
  getPlans,
  getProfile,
  getTokens,
  api,
} from '@/lib/api';
import { redirectTo } from '@/lib/navigation';
import type { BusinessCategoryOption, City, CreatedBusiness, MeResponse, PlanItem } from '@/lib/types';
import { BusinessLocationPicker, type BusinessPoint } from './business-location-picker';

const tierName: Record<string, string> = { GOLD: 'طلایی', SILVER: 'نقره‌ای' };

function rial(value: number): string {
  return `${value.toLocaleString('fa-IR')} ریال`;
}

export function BusinessRegistrationForm() {
  const router = useRouter();
  const [categories, setCategories] = useState<BusinessCategoryOption[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [cityName, setCityName] = useState('');
  const [citySlug, setCitySlug] = useState('');
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [location, setLocation] = useState<BusinessPoint | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [planId, setPlanId] = useState('');
  const [registered, setRegistered] = useState<CreatedBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getTokens()) {
      router.replace('/login?next=/business/register');
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const [categoryRows, planRows, profile, cities] = await Promise.all([
          getBusinessCategories(),
          getPlans(),
          getProfile(),
          api.get<City[]>('/cities'),
        ]);
        if (!alive) return;
        setCategories(categoryRows);
        setPlans(planRows.filter((plan) => plan.tier === 'SILVER' || plan.tier === 'GOLD'));
        setMe(profile);
        setPhone(profile.phone);
        const city = cities.find((row) => row.id === profile.cityId);
        if (!city) {
          setError('ابتدا شهر خود را از صفحهٔ اصلی انتخاب کنید.');
        } else {
          setCityName(city.name);
          setCitySlug(city.slug);
          if (city.latitude !== null && city.longitude !== null) {
            setCenter({ latitude: city.latitude, longitude: city.longitude });
          } else {
            setError('برای این شهر هنوز مرکز نقشه ثبت نشده است.');
          }
        }
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) router.replace('/login?next=/business/register');
        else setError(err instanceof Error ? err.message : 'بارگذاری فرم ثبت کسب‌وکار ناموفق بود');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!me?.cityId) return setError('برای ثبت کسب‌وکار، ابتدا شهر خود را انتخاب کنید.');
    if (!categoryId) return setError('دسته‌بندی کسب‌وکار را انتخاب کنید.');
    if (name.trim().length < 3) return setError('نام کسب‌وکار باید دست‌کم ۳ حرف باشد.');
    if (!location) return setError('موقعیت کسب‌وکار را روی نقشه مشخص کنید.');
    if (!planId) return setError('یکی از پلن‌های نقره‌ای یا طلایی را انتخاب کنید.');
    if (!registered && phone.trim() && !/^09\d{9}$/.test(phone.trim())) {
      return setError('شماره تماس باید با قالب 09123456789 باشد.');
    }

    setBusy(true);
    try {
      let business = registered;
      if (!business) {
        business = await createBusiness({
          categoryId: Number(categoryId),
          name: name.trim(),
          description: description.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          latitude: location.latitude,
          longitude: location.longitude,
        });
        setRegistered(business);
      }
      const checkout = await checkoutPlan({ planId: Number(planId), businessId: business.id });
      redirectTo(checkout.payUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'اتصال به درگاه ممکن نشد؛ دوباره تلاش کنید.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="muted loading" aria-busy>در حال آماده‌سازی فرم ثبت کسب‌وکار…</p>;

  return (
    <div className="ad-page business-register-page">
      <section className="form-card business-register-card">
        <div className="business-register-head">
          <span className="icon-tile icon-tile--lg" aria-hidden>🏪</span>
          <div>
            <h1>ثبت کسب‌وکار</h1>
            <p className="muted small">مشخصات، محل روی نقشه و اشتراک مناسب کسب‌وکارت را ثبت کن.</p>
          </div>
        </div>

        {cityName && <p className="business-register-city">شهر انتخاب‌شده: <strong>{cityName}</strong></p>}
        {error && <div className="banner banner--error" role="alert">{error}</div>}
        {registered && (
          <div className="banner banner--ok" role="status">
            «{registered.name}» ثبت شد و پس از پرداخت برای بررسی مدیر ارسال می‌شود. برای تکمیل، پلن را انتخاب و به درگاه بروید.
          </div>
        )}

        <form onSubmit={(event) => void submit(event)} className="business-register-form">
          <div className="business-register-fields">
            <label className="field">
              <span>نام کسب‌وکار <b>*</b></span>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required disabled={busy || !!registered} placeholder="مثلاً کافهٔ ساحلی" />
            </label>
            <label className="field">
              <span>دسته‌بندی <b>*</b></span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required disabled={busy || !!registered}>
                <option value="">انتخاب دسته‌بندی</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.icon ? `${category.icon} ` : ''}{category.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>شماره تماس</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" dir="ltr" maxLength={11} disabled={busy || !!registered} placeholder="09123456789" />
            </label>
            <label className="field">
              <span>نشانی</span>
              <input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={300} disabled={busy || !!registered} placeholder="خیابان، کوچه، پلاک…" />
            </label>
            <label className="field business-register-description">
              <span>معرفی کوتاه</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} rows={4} disabled={busy || !!registered} placeholder="خدمات و ویژگی‌های کسب‌وکارت را توضیح بده…" />
            </label>
          </div>

          <section className="business-location-section" aria-labelledby="business-location-title">
            <div className="business-register-section-head">
              <h2 id="business-location-title">موقعیت روی نقشه <b>*</b></h2>
              <p className="muted small">محل دقیق را با کلیک یا جابه‌جایی نشانگر تعیین کنید.</p>
            </div>
            {center ? (
              <BusinessLocationPicker center={center} onChange={setLocation} />
            ) : (
              <p className="empty-state">مرکز نقشهٔ شهر در دسترس نیست.</p>
            )}
            {location && (
              <p className="business-location-coordinates" role="status">
                موقعیت انتخاب‌شده: {location.latitude.toFixed(5)}، {location.longitude.toFixed(5)}
              </p>
            )}
          </section>

          <section className="business-plans-section" aria-labelledby="business-plan-title">
            <div className="business-register-section-head">
              <h2 id="business-plan-title">انتخاب اشتراک <b>*</b></h2>
              <p className="muted small">پرداخت امن در پایان از طریق درگاه زرین‌پال انجام می‌شود.</p>
            </div>
            {plans.length === 0 ? (
              <p className="empty-state">در حال حاضر پلن نقره‌ای یا طلایی فعالی وجود ندارد.</p>
            ) : (
              <div className="business-plan-options">
                {plans.map((plan) => (
                  <label key={plan.id} className={`business-plan-option${Number(planId) === plan.id ? ' is-selected' : ''} business-plan-option--${plan.tier.toLowerCase()}`}>
                    <input type="radio" name="business-plan" value={plan.id} checked={Number(planId) === plan.id} onChange={() => setPlanId(String(plan.id))} disabled={busy} />
                    <span className="business-plan-option__icon" aria-hidden>{plan.tier === 'GOLD' ? '👑' : '🥈'}</span>
                    <span className="business-plan-option__body">
                      <strong>{tierName[plan.tier]} — {plan.label}</strong>
                      <small>{plan.durationDays.toLocaleString('fa-IR')} روز · {rial(plan.price)}</small>
                      {plan.badge && <small className="business-plan-option__badge">{plan.badge}</small>}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <p className="business-register-note">ثبت اولیهٔ کسب‌وکار به‌صورت «در انتظار بررسی» انجام می‌شود. پرداخت موفق به‌تنهایی کسب‌وکار را منتشر نمی‌کند؛ نمایش عمومی پس از تأیید مدیر خواهد بود.</p>
          <div className="business-register-actions">
            <button className="btn btn-primary" type="submit" disabled={busy || !me?.cityId || categories.length === 0 || plans.length === 0 || !center}>
              {busy ? 'در حال پردازش…' : registered ? 'ادامه به درگاه زرین‌پال' : 'ثبت کسب‌وکار و پرداخت'}
            </button>
            <Link className="btn btn-ghost" href={citySlug ? `/city/${encodeURIComponent(citySlug)}` : '/'}>بازگشت</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
