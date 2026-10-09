'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  api,
  createBusiness,
  getBusinessCategories,
  getMyBusinesses,
  getProfile,
  getTokens,
  uploadImage,
} from '@/lib/api';
import type { CreateBusinessInput } from '@/lib/api';
import type { BusinessCategoryOption, City, CreatedBusiness, MeResponse, MyBusinessItem } from '@/lib/types';
import { StatusChip } from './my-ads';
import { BusinessMapPicker, type MapPoint } from './business-map-picker';

const STEPS = [
  { id: 'basic', title: 'اطلاعات پایه', icon: '📝' },
  { id: 'category', title: 'دسته‌بندی', icon: '🗂️' },
  { id: 'contact', title: 'اطلاعات تماس', icon: '📞' },
  { id: 'images', title: 'تصاویر', icon: '🖼️' },
  { id: 'location', title: 'موقعیت روی نقشه', icon: '📍' },
] as const;

const IRANIAN_MOBILE = /^09\d{9}$/;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function safePreview(file: File): string {
  try {
    return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '';
  } catch {
    return '';
  }
}

function round6(n: number): number {
  return Number(n.toFixed(6));
}

/**
 * Business registration wizard (5 RTL steps): basic info → category →
 * contact → images → map pin. Submission always lands as PENDING — only the
 * admin queue publishes it — and paid tiers come later through /plans,
 * separate from moderation.
 */
export function BusinessForm() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<BusinessCategoryOption[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [mine, setMine] = useState<MyBusinessItem[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [instagram, setInstagram] = useState('');
  const [telegram, setTelegram] = useState('');
  const [website, setWebsite] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [point, setPoint] = useState<MapPoint | null>(null);
  const pointTouched = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedBusiness | null>(null);

  const refreshMine = () => getMyBusinesses().then(setMine).catch(() => {});

  // login gate + initial data (same pattern as AdForm)
  useEffect(() => {
    if (!getTokens()) {
      router.replace('/login?next=/businesses/new');
      return;
    }
    let alive = true;
    getBusinessCategories()
      .then((list) => alive && setCategories(list))
      .catch(() => alive && setCategoriesError('دریافت دسته‌بندی‌ها ناموفق بود؛ صفحه را دوباره باز کنید'));
    getProfile()
      .then((profile) => {
        if (!alive) return;
        setMe(profile);
        if (profile.phone) setPhone((current) => current || profile.phone);
      })
      .catch(() => {
        if (alive) router.replace('/login?next=/businesses/new');
      });
    api
      .get<City[]>('/cities')
      .then((list) => alive && setCities(list))
      .catch(() => {});
    refreshMine();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // previews follow the picked files
  useEffect(() => {
    const url = logo ? safePreview(logo) : '';
    setLogoPreview(url);
    return () => {
      if (url) {
        try {
          URL.revokeObjectURL?.(url);
        } catch {
          // best-effort cleanup
        }
      }
    };
  }, [logo]);

  useEffect(() => {
    const url = cover ? safePreview(cover) : '';
    setCoverPreview(url);
    return () => {
      if (url) {
        try {
          URL.revokeObjectURL?.(url);
        } catch {
          // best-effort cleanup
        }
      }
    };
  }, [cover]);

  const myCity = me?.cityId ? (cities.find((c) => c.id === me.cityId) ?? null) : null;
  const center: MapPoint | null =
    myCity && myCity.latitude !== null && myCity.longitude !== null
      ? { lat: myCity.latitude, lng: myCity.longitude }
      : null;

  // default the pin to the city center until the user moves/clears it
  useEffect(() => {
    if (center && !pointTouched.current) setPoint(center);
  }, [center?.lat, center?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickImage = (
    picked: File[],
    setter: (f: File | null) => void,
    label: string,
  ) => {
    const file = picked[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(`فرمت ${label} پشتیبانی نمی‌شود (JPG، PNG، WebP یا GIF)`);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`حجم ${label} نباید بیشتر از ۵ مگابایت باشد`);
      return;
    }
    setError(null);
    setter(file);
  };

  const validateStep = (index: number): string | null => {
    if (me && !me.hasSelectedCity) return 'ابتدا شهر خودت را انتخاب کن تا کسب‌وکار در آن شهر ثبت شود';
    if (index === 0) {
      const n = name.trim();
      if (n.length < 3) return 'نام کسب‌وکار باید حداقل ۳ حرف باشد';
      if (n.length > 160) return 'نام کسب‌وکار نباید بیشتر از ۱۶۰ حرف باشد';
      if (description.trim().length > 4000) return 'توضیحات نباید بیشتر از ۴۰۰۰ حرف باشد';
    }
    if (index === 1 && !categoryId) return 'دسته‌بندی کسب‌وکار را انتخاب کنید';
    if (index === 2) {
      const p = phone.trim();
      if (p && !IRANIAN_MOBILE.test(p)) return 'شماره تماس معتبر نیست (مثال: 09123456789)';
      if (address.trim().length > 300) return 'آدرس نباید بیشتر از ۳۰۰ حرف باشد';
    }
    return null;
  };

  const next = () => {
    const problem = validateStep(step);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (let i = 0; i < STEPS.length; i++) {
      const problem = validateStep(i);
      if (problem) {
        setStep(i);
        setError(problem);
        return;
      }
    }
    setError(null);
    setBusy(true);
    try {
      let logoMediaId: number | undefined;
      let coverMediaId: number | undefined;
      if (logo) {
        setProgress('در حال آپلود تصویر لوگو…');
        logoMediaId = (await uploadImage(logo, 'business')).id;
      }
      if (cover) {
        setProgress('در حال آپلود تصویر کاور…');
        coverMediaId = (await uploadImage(cover, 'business')).id;
      }

      const body: CreateBusinessInput = {
        categoryId: Number(categoryId),
        name: name.trim(),
      };
      const d = description.trim();
      if (d) body.description = d;
      const p = phone.trim();
      if (p) body.phone = p;
      const a = address.trim();
      if (a) body.address = a;
      if (point) {
        body.latitude = round6(point.lat);
        body.longitude = round6(point.lng);
      }
      if (logoMediaId !== undefined) body.logoMediaId = logoMediaId;
      if (coverMediaId !== undefined) body.coverMediaId = coverMediaId;
      const social: NonNullable<CreateBusinessInput['socialLinks']> = {};
      if (instagram.trim()) social.instagram = instagram.trim();
      if (telegram.trim()) social.telegram = telegram.trim();
      if (website.trim()) social.website = website.trim();
      if (Object.keys(social).length > 0) body.socialLinks = social;

      setProgress('در حال ثبت درخواست…');
      const result = await createBusiness(body);
      setCreated(result);
      refreshMine();
      setStep(0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ثبت درخواست با خطا مواجه شد؛ دوباره تلاش کنید');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const reset = () => {
    setCreated(null);
    setName('');
    setDescription('');
    setCategoryId('');
    setAddress('');
    setInstagram('');
    setTelegram('');
    setWebsite('');
    setLogo(null);
    setCover(null);
    pointTouched.current = false;
    setError(null);
  };

  const mineSection = (
    <section className="form-card my-businesses" aria-label="کسب‌وکارهای من" id="mine">
      <h2>کسب‌وکارهای من</h2>
      {mine.length === 0 ? (
        <p className="muted" data-testid="businesses-empty">
          هنوز درخواستی ثبت نکرده‌اید.
        </p>
      ) : (
        <ul className="mine-businesses">
          {mine.map((b) => (
            <li key={b.id} data-testid="my-business">
              <span aria-hidden>{b.categoryIcon ?? '🏪'}</span>
              <div className="mine-businesses__body">
                <strong>{b.name}</strong>
                <span className="muted">
                  {b.categoryName} · {b.cityName}
                </span>
              </div>
              <Link
                href={`/plans?business=${b.id}`}
                className="pill"
                title="انتخاب اشتراک طلایی/نقره‌ای"
                data-testid={`plan-link-${b.id}`}
              >
                <span aria-hidden>⭐</span>
                <span className="pill__label">اشتراک</span>
              </Link>
              <StatusChip status={b.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  if (created) {
    return (
      <div className="ad-page">
        <div className="form-card business-success" data-testid="business-success">
          <h1>درخواست ثبت کسب‌وکار ثبت شد</h1>
          <p className="muted">
            «{created.name}» برای بررسی مدیر ارسال شد تا پس از تأیید در نقشه و ویترین شهر نمایش داده شود.
          </p>
          <p>
            <span data-testid="business-status">
              <StatusChip status={created.status} />
            </span>
          </p>
          <p className="field-hint">
            اشتراک طلایی/نقره‌ای جداگانه خریداری می‌شود و پس از پرداخت و تأییدهای لازم فعال خواهد شد.
          </p>
          <div className="auth-actions">
            <Link href={`/plans?business=${created.id}`} className="btn btn-primary" data-testid="choose-plan">
              انتخاب اشتراک طلایی/نقره‌ای
            </Link>
            <Link href="/" className="btn btn-ghost">
              بازگشت
            </Link>
            <button type="button" className="btn btn-ghost" onClick={reset} data-testid="register-another">
              ثبت کسب‌وکار دیگر
            </button>
          </div>
        </div>
        {mineSection}
      </div>
    );
  }

  const noCity = me !== null && !me.hasSelectedCity;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="ad-page">
      <form className="form-card business-form" onSubmit={submit} noValidate data-testid="business-form">
        <h1>ثبت کسب‌وکار</h1>
        <p className="muted">
          کسب‌وکار شما پس از ارسال، در انتظار بررسی مدیر می‌ماند و فقط با تأیید او منتشر می‌شود.
        </p>

        {noCity && (
          <div className="banner banner--warn" role="status">
            <span>برای ثبت کسب‌وکار ابتدا شهر خودت را انتخاب کن.</span>
            <Link href="/" className="btn btn-ghost">
              انتخاب شهر
            </Link>
          </div>
        )}

        <ol className="wizard-steps" aria-label="مراحل ثبت کسب‌وکار">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              className={i === step ? 'is-current' : i < step ? 'is-done' : ''}
              aria-current={i === step ? 'step' : undefined}
              data-testid={`wizard-step-${i}`}
            >
              <span aria-hidden>{s.icon}</span>
              <span className="wizard-steps__num" aria-hidden>
                {i + 1}
              </span>
              {s.title}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <>
            <label htmlFor="biz-name">نام کسب‌وکار</label>
            <input
              id="biz-name"
              name="name"
              type="text"
              maxLength={160}
              placeholder="مثال: نانوایی سنگک امید"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              data-testid="field-name"
            />

            <label htmlFor="biz-description">درباره کسب‌وکار — اختیاری</label>
            <textarea
              id="biz-description"
              name="description"
              maxLength={4000}
              placeholder="محصولات، ویژگی‌ها، تجربه…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="field-description"
            />
          </>
        )}

        {step === 1 && (
          <>
            <span className="field-label" id="category-label">
              دسته‌بندی کسب‌وکار
            </span>
            <div className="category-grid" role="radiogroup" aria-labelledby="category-label">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={categoryId === String(c.id)}
                  className={`category-card${categoryId === String(c.id) ? ' is-selected' : ''}`}
                  onClick={() => {
                    setCategoryId(String(c.id));
                    setError(null);
                  }}
                  data-testid="category-option"
                  data-id={c.id}
                >
                  <span aria-hidden>{c.icon ?? '🏪'}</span>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
            {categories.length === 0 && !categoriesError && (
              <p className="field-hint" aria-busy>
                در حال بارگذاری دسته‌بندی‌ها…
              </p>
            )}
            {categoriesError && (
              <p className="error" role="alert">
                {categoriesError}
              </p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <label htmlFor="biz-phone">شماره تماس</label>
            <input
              id="biz-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              dir="ltr"
              placeholder="09xxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              data-testid="field-phone"
            />

            <label htmlFor="biz-address">آدرس — اختیاری</label>
            <input
              id="biz-address"
              name="address"
              type="text"
              maxLength={300}
              placeholder="خیابان، محله، کوچه…"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              data-testid="field-address"
            />

            <label htmlFor="biz-instagram">اینستاگرام — اختیاری</label>
            <input
              id="biz-instagram"
              name="instagram"
              type="text"
              maxLength={100}
              dir="ltr"
              placeholder="@username"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              data-testid="field-instagram"
            />

            <label htmlFor="biz-telegram">تلگرام — اختیاری</label>
            <input
              id="biz-telegram"
              name="telegram"
              type="text"
              maxLength={100}
              dir="ltr"
              placeholder="@channel"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              data-testid="field-telegram"
            />

            <label htmlFor="biz-website">وب‌سایت — اختیاری</label>
            <input
              id="biz-website"
              name="website"
              type="text"
              maxLength={200}
              dir="ltr"
              placeholder="https://…"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              data-testid="field-website"
            />
          </>
        )}

        {step === 3 && (
          <>
            <label htmlFor="biz-logo">لوگو — اختیاری</label>
            <input
              id="biz-logo"
              name="logo"
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              onChange={(e) => {
                pickImage(Array.from(e.target.files ?? []), setLogo, 'لوگو');
                e.target.value = '';
              }}
              data-testid="field-logo"
            />
            {logoPreview && (
              <ul className="image-grid">
                <li className="image-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                  {logoPreview && <img src={logoPreview} alt="پیش‌نمایش لوگو" />}
                  <button
                    type="button"
                    className="image-thumb__remove"
                    aria-label="حذف لوگو"
                    onClick={() => setLogo(null)}
                  >
                    ✕
                  </button>
                </li>
              </ul>
            )}

            <label htmlFor="biz-cover">تصویر کاور — اختیاری</label>
            <input
              id="biz-cover"
              name="cover"
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              onChange={(e) => {
                pickImage(Array.from(e.target.files ?? []), setCover, 'کاور');
                e.target.value = '';
              }}
              data-testid="field-cover"
            />
            {coverPreview && (
              <ul className="image-grid">
                <li className="image-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                  {coverPreview && <img src={coverPreview} alt="پیش‌نمایش کاور" />}
                  <button
                    type="button"
                    className="image-thumb__remove"
                    aria-label="حذف کاور"
                    onClick={() => setCover(null)}
                  >
                    ✕
                  </button>
                </li>
              </ul>
            )}
            <p className="field-hint">هر تصویر حداکثر ۵ مگابایت (JPG، PNG، WebP یا GIF).</p>
          </>
        )}

        {step === 4 && (
          <>
            <span className="field-label">موقعیت روی نقشه</span>
            <p className="field-hint">
              با کلیک روی نقشه یا جابه‌جایی پین، موقعیت کسب‌وکار را انتخاب کنید.
            </p>
            {center ? (
              <>
                <BusinessMapPicker
                  center={center}
                  value={point}
                  onChange={(p) => {
                    pointTouched.current = true;
                    setPoint(p);
                  }}
                />
                <p className="field-hint" data-testid="coord-readout" dir="ltr">
                  {point ? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : 'بدون موقعیت'}
                </p>
                <div className="auth-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      pointTouched.current = true;
                      setPoint(center);
                    }}
                    data-testid="use-city-center"
                  >
                    استفاده از مرکز شهر
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      pointTouched.current = true;
                      setPoint(null);
                    }}
                    data-testid="drop-point"
                  >
                    ثبت بدون موقعیت
                  </button>
                </div>
              </>
            ) : (
              <p className="error" role="alert" data-testid="no-center">
                موقعیت شهر شما ثبت نشده است؛ می‌توانید بدون موقعیت نقشه ثبت کنید.
              </p>
            )}
          </>
        )}

        {error && (
          <p className="error" role="alert" data-testid="form-error">
            {error}
          </p>
        )}
        {progress && (
          <p className="field-hint" aria-busy>
            {progress}
          </p>
        )}

        <div className="wizard-nav">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={back}
            disabled={step === 0 || busy}
            data-testid="step-back"
          >
            قبلی
          </button>
          {!isLast ? (
            <button type="button" className="btn btn-primary" onClick={next} disabled={busy} data-testid="step-next">
              بعدی
            </button>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={busy} data-testid="submit-business">
              {busy ? 'در حال ارسال…' : 'ارسال درخواست'}
            </button>
          )}
        </div>
      </form>

      {mineSection}
    </div>
  );
}
