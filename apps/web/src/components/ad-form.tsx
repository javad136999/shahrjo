'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  createAd,
  getAdCategories,
  getMyAds,
  getProfile,
  getTokens,
  uploadImage,
} from '@/lib/api';
import type { CreateAdInput } from '@/lib/api';
import type { AdCategoryOption, CreatedAd, MeResponse, MyAdItem } from '@/lib/types';
import { MyAdsList, STATUS_LABEL, StatusChip } from './my-ads';

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const IRANIAN_MOBILE = /^09\d{9}$/;

/** Persian/Arabic digits → Latin so «۱٬۲۰۰» parses as a number. */
function toLatinDigits(raw: string): string {
  return raw.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

type PriceResult = { kind: 'empty' } | { kind: 'ok'; value: number } | { kind: 'invalid' };

/** Empty => «توافقی» (no price field sent). Non-numeric / out of range => invalid. */
export function parsePrice(raw: string): PriceResult {
  const s = toLatinDigits(raw).replace(/[,\s٬]/g, '').trim();
  if (!s) return { kind: 'empty' };
  if (!/^\d{1,16}$/.test(s)) return { kind: 'invalid' };
  const value = Number(s);
  if (!Number.isSafeInteger(value) || value > 9_000_000_000_000_000) return { kind: 'invalid' };
  return { kind: 'ok', value };
}

function previewUrl(file: File): string {
  try {
    return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '';
  } catch {
    return '';
  }
}

function releasePreview(url: string): void {
  if (!url) return;
  try {
    URL.revokeObjectURL?.(url);
  } catch {
    // best-effort cleanup
  }
}

/**
 * Ad submission form (Phase 5): picks images client-side, uploads each to
 * POST /uploads, then creates the ad via POST /ads — which always answers
 * PENDING (moderation). Shows the owner's own ads with their status below.
 */
export function AdForm() {
  const router = useRouter();

  const [categories, setCategories] = useState<AdCategoryOption[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [myAds, setMyAds] = useState<MyAdItem[]>([]);

  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<CreatedAd | null>(null);

  // login gate + initial data
  useEffect(() => {
    if (!getTokens()) {
      router.replace('/login?next=/ads/new');
      return;
    }
    let alive = true;
    getAdCategories()
      .then((list) => alive && setCategories(list))
      .catch(() => alive && setCategoriesError('دریافت دسته‌بندی‌ها ناموفق بود؛ صفحه را دوباره باز کنید'));
    getProfile()
      .then((profile) => {
        if (!alive) return;
        setMe(profile);
        if (!profile.phone) return;
        setPhone((current) => current || profile.phone);
      })
      .catch(() => {
        // expired session without refresh: api layer already cleared tokens
        if (alive) router.replace('/login?next=/ads/new');
      });
    getMyAds()
      .then((list) => alive && setMyAds(list))
      .catch(() => {
        // list is secondary — the form still works
      });
    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    const urls = files.map(previewUrl);
    setPreviews(urls);
    return () => urls.forEach(releasePreview);
  }, [files]);

  const addFiles = (picked: File[]) => {
    const valid: File[] = [];
    for (const file of picked) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('فرمت فایل پشتیبانی نمی‌شود (JPG، PNG، WebP یا GIF)');
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError('حجم هر تصویر نباید بیشتر از ۵ مگابایت باشد');
        continue;
      }
      if (files.length + valid.length >= MAX_IMAGES) {
        setError(`حداکثر ${MAX_IMAGES.toLocaleString('fa-IR')} تصویر می‌توانید اضافه کنید`);
        break;
      }
      valid.push(file);
    }
    if (valid.length) setFiles([...files, ...valid]);
  };

  const removeFile = (index: number) => setFiles(files.filter((_, i) => i !== index));

  const validate = (): string | null => {
    if (!categoryId) return 'دسته‌بندی آگهی را انتخاب کنید';
    const t = title.trim();
    if (t.length < 4) return 'عنوان باید حداقل ۴ حرف باشد';
    if (t.length > 160) return 'عنوان نباید بیشتر از ۱۶۰ حرف باشد';
    const d = description.trim();
    if (d.length < 10) return 'توضیحات باید حداقل ۱۰ حرف باشد';
    if (d.length > 4000) return 'توضیحات نباید بیشتر از ۴۰۰۰ حرف باشد';
    if (parsePrice(price).kind === 'invalid') return 'قیمت باید عدد صحیح باشد (به ریال)؛ یا خالی بگذارید (توافقی)';
    const p = phone.trim();
    if (p && !IRANIAN_MOBILE.test(p)) return 'شماره تماس معتبر نیست (مثال: 09123456789)';
    if (address.trim().length > 300) return 'آدرس نباید بیشتر از ۳۰۰ حرف باشد';
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const imageIds: number[] = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(`در حال آپلود تصاویر (${(i + 1).toLocaleString('fa-IR')} از ${files.length.toLocaleString('fa-IR')})…`);
        const stored = await uploadImage(files[i]);
        imageIds.push(stored.id);
      }
      setProgress('در حال ثبت آگهی…');
      const body: CreateAdInput = {
        categoryId: Number(categoryId),
        title: title.trim(),
        description: description.trim(),
      };
      const parsedPrice = parsePrice(price);
      if (parsedPrice.kind === 'ok') body.price = parsedPrice.value;
      const p = phone.trim();
      if (p) body.phone = p;
      const a = address.trim();
      if (a) body.address = a;
      if (imageIds.length) body.imageIds = imageIds;

      const created = await createAd(body);
      setSubmitted(created);
      router.push('/wall');
      // reset for the next ad
      setCategoryId('');
      setTitle('');
      setDescription('');
      setPrice('');
      setAddress('');
      setFiles([]);
      getMyAds()
        .then(setMyAds)
        .catch(() => {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ثبت آگهی با خطا مواجه شد؛ دوباره تلاش کنید');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  if (submitted) {
    return (
      <div className="form-card ad-success" data-testid="ad-success">
        <h1>آگهی شما ثبت شد</h1>
        <p className="muted">
          «{submitted.title}» برای بررسی ناظر ثبت شد و پیش‌نمایش آن همین حالا در دیوار شهر قرار گرفت.
        </p>
        <p>
          <span data-testid="ad-status">
            <StatusChip status={submitted.status} />
          </span>
        </p>
        <div className="auth-actions">
          <Link href="/wall" className="btn btn-ghost">
            مشاهده دیوار شهر
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => setSubmitted(null)}>
            ثبت آگهی دیگر
          </button>
        </div>
      </div>
    );
  }

  const noCity = me !== null && !me.hasSelectedCity;

  return (
    <div className="ad-page">
      <form className="form-card ad-form" onSubmit={submit} noValidate>
        <h1>ثبت آگهی</h1>
        <p className="muted">آگهی پس از ارسال برای بررسی ناظر می‌رود و پیش‌نمایش آن در دیوار شهر دیده می‌شود.</p>

        {noCity && (
          <div className="banner banner--warn" role="status">
            <span>برای ثبت آگهی ابتدا شهر خودت را انتخاب کن.</span>
            <Link href="/" className="btn btn-ghost">
              انتخاب شهر
            </Link>
          </div>
        )}

        <label htmlFor="category">دسته‌بندی</label>
        <select
          id="category"
          name="category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
        >
          <option value="">— انتخاب دسته‌بندی —</option>
          {categories.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.icon ? `${c.icon} ` : ''}
              {c.name}
            </option>
          ))}
        </select>
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

        <label htmlFor="title">عنوان آگهی</label>
        <input
          id="title"
          name="title"
          type="text"
          maxLength={160}
          placeholder="مثال: لوازم خانگی نو"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <label htmlFor="description">توضیحات</label>
        <textarea
          id="description"
          name="description"
          maxLength={4000}
          placeholder="شرایط، قیمت پیشنهادی، زمان تماس…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <label htmlFor="price">قیمت (ریال) — اختیاری</label>
        <input
          id="price"
          name="price"
          type="text"
          inputMode="numeric"
          placeholder="خالی = توافقی"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <label htmlFor="phone">شماره تماس</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          dir="ltr"
          placeholder="09xxxxxxxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <label htmlFor="address">آدرس — اختیاری</label>
        <input
          id="address"
          name="address"
          type="text"
          maxLength={300}
          placeholder="خیابان، محله…"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <label htmlFor="images">
          تصاویر (حداکثر {MAX_IMAGES.toLocaleString('fa-IR')} — هر کدام تا ۵ مگابایت)
        </label>
        <input
          id="images"
          name="images"
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        {previews.length > 0 && (
          <ul className="image-grid">
            {previews.map((url, i) => (
              <li key={`${files[i]?.name}-${i}`} className="image-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs */}
                {url && <img src={url} alt={files[i]?.name ?? ''} />}
                <button
                  type="button"
                  className="image-thumb__remove"
                  aria-label={`حذف تصویر ${i + 1}`}
                  onClick={() => removeFile(i)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {progress && (
          <p className="field-hint" aria-busy>
            {progress}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'در حال ارسال…' : 'ارسال'}
        </button>
      </form>

      <section className="form-card my-ads" aria-label="آگهی‌های من" id="mine">
        <h2>آگهی‌های من</h2>
        <MyAdsList items={myAds} />
      </section>
    </div>
  );
}
