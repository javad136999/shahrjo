'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  createBusinessProduct,
  deleteBusinessProduct,
  getBusinessCategories,
  getMyBusiness,
  getTokens,
  updateBusinessProduct,
  updateMyBusiness,
  uploadBusinessImage,
} from '@/lib/api';
import { formatPrice, thumbFallback, thumbUrlFor } from '@/lib/format';
import type { BusinessCategoryOption, BusinessProductItem, ManagedBusiness } from '@/lib/types';
import { BusinessListingsManager } from '@/components/business-listings-manager';

type Tab = 'info' | 'menu' | 'listings';

/** The product being edited (null = the form is closed). */
interface ProductDraft {
  /** null = a new row. */
  id: number | null;
  name: string;
  section: string;
  description: string;
  /** Rial as typed; empty string = «توافقی». */
  price: string;
  imageUrl: string;
  isAvailable: boolean;
}

const emptyDraft = (section = ''): ProductDraft => ({
  id: null,
  name: '',
  section,
  description: '',
  price: '',
  imageUrl: '',
  isAvailable: true,
});

const toDraft = (product: BusinessProductItem): ProductDraft => ({
  id: product.id,
  name: product.name,
  section: product.section ?? '',
  description: product.description ?? '',
  price: product.price === null ? '' : String(product.price),
  imageUrl: product.imageUrl ?? '',
  isAvailable: product.isAvailable,
});

/** Rial as typed ("250,000"/"۲۵۰۰۰۰") → number, or undefined for «توافقی». */
function parsePrice(raw: string): number | undefined {
  const digits = raw.replace(/[^\d۰-۹]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  if (!digits) return undefined;
  const value = Number(digits);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Owner workspace of one business: edit its public profile, and build the menu
 * — sections («نوشیدنی»، «غذاهای اصلی»…), products with photo, description and
 * price. Everything saved here shows on the public business page, including
 * when a visitor arrives by tapping the business pin on the city map.
 * Login-gated and owner-scoped server-side (`/my-businesses/:id` 404s others).
 */
export function BusinessManage({ id, initialTab = 'info' }: { id: number; initialTab?: Tab }) {
  const router = useRouter();
  const [data, setData] = useState<ManagedBusiness | null>(null);
  const [categories, setCategories] = useState<BusinessCategoryOption[]>([]);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // profile form
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // product form
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const apply = (business: ManagedBusiness) => {
    setData(business);
    setName(business.name);
    setLogoUrl(business.logoUrl ?? '');
    setCategoryId(String(business.categoryId));
    setDescription(business.description ?? '');
    setPhone(business.phone ?? '');
    setAddress(business.address ?? '');
    if (business.category.slug === 'real_estate' || business.category.slug === 'car_dealer') setTab('listings');
  };

  useEffect(() => {
    if (!getTokens()) {
      router.replace(`/login?next=/business/${id}/manage`);
      return;
    }
    let alive = true;
    Promise.all([getMyBusiness(id), getBusinessCategories()])
      .then(([business, cats]) => {
        if (!alive) return;
        apply(business);
        setCategories(cats);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(
          err instanceof ApiError
            ? err.status === 404
              ? 'این کسب‌وکار متعلق به تو نیست یا وجود ندارد.'
              : err.message
            : 'دریافت کسب‌وکار ناموفق بود',
        );
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per id
  }, [id, router]);

  /** Menu sections in registration order — the group headings of the menu. */
  const sections = useMemo(() => {
    const seen: string[] = [];
    for (const product of data?.products ?? []) {
      const key = product.section ?? '';
      if (!seen.includes(key)) seen.push(key);
    }
    return seen;
  }, [data]);

  const saveInfo = async () => {
    if (name.trim().length < 2) {
      setError('نام کسب‌وکار باید حداقل ۲ حرف باشد');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      apply(
        await updateMyBusiness(id, {
          name: name.trim(),
          categoryId: categoryId ? Number(categoryId) : undefined,
          description,
          phone,
          address,
          // '' clears the photo (the server then frees its bytes in the sweep)
          logoUrl: logoUrl === (data?.logoUrl ?? '') ? undefined : logoUrl,
        }),
      );
      setNotice('مشخصات ذخیره شد.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ذخیرهٔ مشخصات ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Both uploads (business photo and product photo) go through the
   * hard-compressed business profile server-side, so an owner can register
   * dozens of menu rows without eating the disk.
   */
  const pickImage = async (file: File | null) => {
    if (!file || !draft) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('حجم هر عکس باید حداکثر ۱۰ مگابایت باشد. یک عکس کوچک‌تر انتخاب کن.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadBusinessImage(file);
      setDraft({ ...draft, imageUrl: uploaded.url });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'بارگذاری تصویر ناموفق بود');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const pickLogo = async (file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('حجم هر عکس باید حداکثر ۱۰ مگابایت باشد. یک عکس کوچک‌تر انتخاب کن.');
      if (logoRef.current) logoRef.current.value = '';
      return;
    }
    setLogoBusy(true);
    setError(null);
    try {
      const uploaded = await uploadBusinessImage(file);
      setLogoUrl(uploaded.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'بارگذاری عکس کسب‌وکار ناموفق بود');
    } finally {
      setLogoBusy(false);
      if (logoRef.current) logoRef.current.value = '';
    }
  };

  const saveProduct = async () => {
    if (!draft) return;
    if (draft.name.trim().length === 0) {
      setError('نام محصول الزامی است');
      return;
    }
    if (!data) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const body = {
      name: draft.name.trim(),
      section: draft.section.trim(),
      description: draft.description.trim(),
      price: parsePrice(draft.price),
      imageUrl: draft.imageUrl,
      isAvailable: draft.isAvailable,
    };
    try {
      const saved =
        draft.id === null
          ? await createBusinessProduct(id, body)
          : await updateBusinessProduct(id, draft.id, body);
      const products = draft.id === null
        ? [...data.products, saved]
        : data.products.map((row) => (row.id === saved.id ? saved : row));
      setData({ ...data, products, productCount: products.length });
      setDraft(null);
      setNotice(draft.id === null ? 'محصول اضافه شد.' : 'محصول به‌روز شد.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ذخیرهٔ محصول ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  const removeProduct = async (productId: number) => {
    if (!data) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await deleteBusinessProduct(id, productId);
      const products = data.products.filter((row) => row.id !== productId);
      setData({ ...data, products, productCount: products.length });
      if (draft?.id === productId) setDraft(null);
      setNotice('محصول حذف شد.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'حذف محصول ناموفق بود');
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) {
    return (
      <div className="banner banner--error" role="alert">
        <span>{error}</span>
        <Link href="/businesses" className="btn btn-ghost">
          کسب‌وکارهای من
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="muted loading" aria-busy>
        در حال بارگذاری…
      </p>
    );
  }

  const listingKind = data.category.slug === 'real_estate' ? 'PROPERTY' : data.category.slug === 'car_dealer' ? 'VEHICLE' : null;

  const productForm = draft && (
    <form
      className="biz-product-form"
      data-testid="product-form"
      onSubmit={(e) => {
        e.preventDefault();
        void saveProduct();
      }}
      noValidate
    >
      <header className="biz-editor__head">
        <span className="biz-editor__icon" aria-hidden>🍽️</span>
        <div>
          <h3>{draft.id === null ? 'افزودن محصول جدید' : 'ویرایش محصول'}</h3>
          <p>اطلاعات را وارد کن؛ عکس، گروه و قیمت در صفحهٔ عمومی کسب‌وکارت نمایش داده می‌شوند.</p>
        </div>
      </header>

      <div className="biz-product-form__grid">
        <label className="biz-field biz-field--wide" htmlFor="p-name">
          <span>نام محصول <b>*</b></span>
          <input id="p-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={160} placeholder="مثلاً لاته" required data-testid="product-name" />
        </label>
        <label className="biz-field" htmlFor="p-section">
          <span>گروه منو <small>برای مرتب‌سازی محصولات</small></span>
          <input id="p-section" list="biz-sections" value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} maxLength={80} placeholder="مثلاً نوشیدنی" data-testid="product-section" />
          <datalist id="biz-sections">{sections.filter(Boolean).map((section) => <option key={section} value={section} />)}</datalist>
        </label>
        <label className="biz-field" htmlFor="p-price">
          <span>قیمت <small>خالی بماند = توافقی</small></span>
          <span className="biz-price-input">
            <input id="p-price" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} inputMode="numeric" dir="ltr" placeholder="۲۵۰٬۰۰۰" data-testid="product-price" />
            <b>ریال</b>
          </span>
        </label>
        <label className="biz-field biz-field--wide" htmlFor="p-desc">
          <span>توضیحات <small>اختیاری</small></span>
          <textarea id="p-desc" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={1000} placeholder="مواد تشکیل‌دهنده یا توضیح کوتاه محصول" data-testid="product-description" />
        </label>
        <div className="biz-field biz-field--wide">
          <span className="biz-field__label">عکس محصول <small>اختیاری</small></span>
          <div className="biz-product-photo">
            {draft.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- owner-uploaded media
              <img className="biz-product-photo__preview" src={thumbUrlFor(draft.imageUrl) ?? draft.imageUrl} onError={thumbFallback(draft.imageUrl)} alt={`پیش‌نمایش ${draft.name || 'محصول'}`} />
            ) : <span className="biz-product-photo__preview biz-product-photo__preview--empty" aria-hidden>📷</span>}
            <div className="biz-product-photo__controls">
              <input id="p-image" ref={fileRef} className="biz-upload-input" type="file" accept="image/png,image/jpeg,image/webp" data-testid="product-image" aria-describedby="p-image-hint" onChange={(e) => void pickImage(e.target.files?.[0] ?? null)} />
              <label className="biz-photo-trigger" htmlFor="p-image">
                <b>{uploading ? 'در حال بارگذاری…' : draft.imageUrl ? 'تغییر عکس' : 'انتخاب عکس محصول'}</b>
                <small>JPG، PNG یا WebP · حداکثر ۱۰ مگابایت</small>
              </label>
              {draft.imageUrl && <button type="button" className="btn btn-ghost" onClick={() => setDraft({ ...draft, imageUrl: '' })} data-testid="product-image-remove">حذف عکس</button>}
              <small id="p-image-hint" className="biz-photo-hint">تصویر در سرور به WebP با ضلع حداکثر ۱۰۰۰ پیکسل و بندانگشتی ۳۲۰ پیکسلی فشرده می‌شود؛ فایل اصلی نگهداری نمی‌شود. سقف کل تصاویر هر حساب ۱۰۰ مگابایت است.</small>
            </div>
          </div>
          {uploading && <p className="biz-upload-status" aria-busy="true">در حال فشرده‌سازی و بارگذاری امن تصویر…</p>}
        </div>
        <label className="biz-availability" htmlFor="product-available">
          <input id="product-available" type="checkbox" checked={draft.isAvailable} onChange={(e) => setDraft({ ...draft, isAvailable: e.target.checked })} data-testid="product-available" />
          <span><b>محصول موجود است</b><small>اگر خاموش باشد، در صفحهٔ عمومی ناموجود نمایش داده می‌شود.</small></span>
        </label>
      </div>

      <div className="biz-editor__actions">
        <button className="btn btn-primary" type="submit" disabled={busy || uploading} data-testid="product-save">
          {busy ? 'در حال ذخیره…' : 'ذخیرهٔ محصول'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)} disabled={busy}>
          انصراف
        </button>
      </div>
    </form>
  );

  return (
    <section className="biz-manage" data-testid="business-manage">
      <Link href="/businesses" className="back-link">
        ← کسب‌وکارهای من
      </Link>

      <header className="biz-manage__head">
        <div className="biz-manage__title">
          <span className="biz-manage__mark" aria-hidden>🏪</span>
          <div><span className="muted small">مدیریت کسب‌وکار</span><h1>{data.name}</h1></div>
        </div>
        <Link href={`/business/${data.id}`} className="pill">👁 مشاهدهٔ صفحهٔ عمومی</Link>
      </header>

      <nav className="biz-tabs" aria-label="بخش‌های مدیریت">
        <button
          type="button"
          className={`biz-tabs__item${tab === 'info' ? ' is-active' : ''}`}
          onClick={() => setTab('info')}
          data-testid="biz-tab-info"
        >
          ✎ ویرایش مشخصات
        </button>
        {listingKind ? (
          <button
            type="button"
            className={`biz-tabs__item${tab === 'listings' ? ' is-active' : ''}`}
            onClick={() => setTab('listings')}
            data-testid="biz-tab-listings"
          >
            {listingKind === 'PROPERTY' ? '🏠 فایل‌های املاک' : '🚗 خودروها'} ({data.listings.length.toLocaleString('fa-IR')})
          </button>
        ) : null}
        {!listingKind && <button
          type="button"
          className={`biz-tabs__item${tab === 'menu' ? ' is-active' : ''}`}
          onClick={() => setTab('menu')}
          data-testid="biz-tab-menu"
        >
          ▤ منو و محصولات ({data.products.length.toLocaleString('fa-IR')})
        </button>}
      </nav>

      {error && (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="banner banner--ok" role="status" data-testid="biz-notice">
          <span>{notice}</span>
        </div>
      )}

      {tab === 'info' ? (
        <form
          className="biz-panel biz-info-panel"
          data-testid="biz-info-form"
          onSubmit={(e) => {
            e.preventDefault();
            void saveInfo();
          }}
          noValidate
        >
          <header className="biz-editor__head">
            <span className="biz-editor__icon" aria-hidden>🏪</span>
            <div><h2>اطلاعات کسب‌وکار</h2><p>مشخصات و راه‌های تماس را مرتب کن تا مشتری‌ها راحت‌تر پیدایت کنند.</p></div>
          </header>
          <div className="biz-info-grid">
            <label className="biz-field" htmlFor="b-name">
              <span>نام کسب‌وکار <b>*</b></span>
              <input id="b-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} minLength={2} required data-testid="biz-name" />
            </label>
            <label className="biz-field" htmlFor="b-cat">
              <span>دسته‌بندی</span>
              <select id="b-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} data-testid="biz-category">
                <option value="">— انتخاب دسته‌بندی —</option>
                {categories.map((category) => <option key={category.id} value={String(category.id)}>{category.icon ? `${category.icon} ` : ''}{category.name}</option>)}
              </select>
            </label>
            <div className="biz-field biz-field--wide">
              <span className="biz-field__label">عکس کسب‌وکار <small>اختیاری</small></span>
              <div className="biz-product-photo biz-logo-photo">
                {logoUrl ? (
                  <span className="biz-product-photo__preview" data-testid="biz-logo-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element -- owner-uploaded media */}
                    <img src={thumbUrlFor(logoUrl) ?? logoUrl} onError={thumbFallback(logoUrl)} alt={`تصویر ${name}`} />
                  </span>
                ) : <span className="biz-product-photo__preview biz-product-photo__preview--empty" aria-hidden>🏪</span>}
                <div className="biz-product-photo__controls">
                  <input id="b-logo" ref={logoRef} className="biz-upload-input" type="file" accept="image/png,image/jpeg,image/webp" data-testid="biz-logo-input" aria-describedby="b-logo-hint" onChange={(e) => void pickLogo(e.target.files?.[0] ?? null)} />
                  <label className="biz-photo-trigger" htmlFor="b-logo">
                    <b>{logoBusy ? 'در حال بارگذاری…' : logoUrl ? 'تغییر عکس کسب‌وکار' : 'انتخاب عکس کسب‌وکار'}</b>
                    <small>JPG، PNG یا WebP · حداکثر ۱۰ مگابایت</small>
                  </label>
                  {logoUrl && <button type="button" className="btn btn-ghost" data-testid="biz-logo-remove" onClick={() => setLogoUrl('')}>حذف عکس</button>}
                  <small id="b-logo-hint" className="biz-photo-hint">فایل اصلی ذخیره نمی‌شود؛ تصویر به WebP کم‌حجم و بندانگشتی تبدیل می‌شود. سقف کل تصاویر هر حساب ۱۰۰ مگابایت است.</small>
                </div>
              </div>
              {logoBusy && <p className="biz-upload-status" aria-busy="true">در حال فشرده‌سازی و بارگذاری امن تصویر…</p>}
            </div>
            <label className="biz-field biz-field--wide" htmlFor="b-desc">
              <span>دربارهٔ کسب‌وکار <small>اختیاری</small></span>
              <textarea id="b-desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="خدمات، ویژگی‌ها یا توضیح کوتاهی دربارهٔ کسب‌وکار" data-testid="biz-description" />
            </label>
            <label className="biz-field" htmlFor="b-phone">
              <span>شماره تماس <small>اختیاری</small></span>
              <input id="b-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} inputMode="tel" placeholder="شماره‌ای که مشتری با آن تماس بگیرد" data-testid="biz-phone" />
            </label>
            <label className="biz-field" htmlFor="b-addr">
              <span>نشانی <small>اختیاری</small></span>
              <input id="b-addr" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} placeholder="خیابان، کوچه یا نشانی کوتاه" data-testid="biz-address" />
            </label>
          </div>
          <p className="biz-location-note">
            <span aria-hidden>📍</span>
            {data.pinned ? 'موقعیت کسب‌وکار روی نقشه ثبت شده است.' : 'موقعیت روی نقشه ثبت نشده؛ برای نمایش در نقشه، محل کسب‌وکار را هنگام ثبت انتخاب کن.'}
          </p>
          <div className="biz-editor__actions">
            <button className="btn btn-primary" type="submit" disabled={busy || logoBusy} data-testid="biz-save">
              {busy ? 'در حال ذخیره…' : 'ذخیرهٔ تغییرات'}
            </button>
          </div>
        </form>
      ) : tab === 'menu' ? (
        <div className="biz-panel biz-menu" data-testid="biz-menu">
          <div className="biz-menu__head">
            <div><h2 className="biz-panel__title">منو و محصولات</h2><p>محصول‌ها را با عکس، گروه و قیمت بچین تا در صفحهٔ کسب‌وکارت مرتب دیده شوند.</p></div>
            <button type="button" className="btn btn-primary" onClick={() => setDraft(emptyDraft())} data-testid="product-new">
              ＋ افزودن محصول جدید
            </button>
          </div>

          {data.products.length === 0 && !draft && (
            <div className="empty-state" data-testid="biz-menu-empty">
              <span className="empty-state__icon" aria-hidden>🍽️</span>
              <p>هنوز محصولی ثبت نکرده‌ای.</p>
              <small>با افزودن عکس و توضیح کوتاه، منوی کسب‌وکارت را برای مشتری‌ها آماده کن.</small>
              <button type="button" className="btn btn-primary" onClick={() => setDraft(emptyDraft())}>＋ افزودن اولین محصول</button>
            </div>
          )}

          {sections.map((section) => (
            <section key={section || 'none'} className="biz-menu__group" data-testid={`biz-menu-group-${section || 'none'}`}>
              <h3 className="biz-menu__section">{section || 'بدون گروه'} <span>{data.products.filter((product) => (product.section ?? '') === section).length.toLocaleString('fa-IR')} محصول</span></h3>
              <ul className="biz-menu__list">
                {data.products
                  .filter((product) => (product.section ?? '') === section)
                  .map((product) => (
                    <li key={product.id} className="biz-menu__row" data-testid={`biz-product-${product.id}`}>
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- owner-uploaded media
                        <img
                          className="biz-menu__thumb"
                          src={thumbUrlFor(product.imageUrl) ?? product.imageUrl}
                          onError={thumbFallback(product.imageUrl)}
                          alt=""
                        />
                      ) : (
                        <span className="biz-menu__thumb biz-menu__thumb--empty" aria-hidden>
                          🍽
                        </span>
                      )}
                      <div className="biz-menu__info">
                        <b>{product.name}</b>
                        {product.description && <small>{product.description}</small>}
                        <span className="biz-menu__price">{formatPrice(product.price)}</span>
                        {!product.isAvailable && <span className="badge badge--rose">ناموجود</span>}
                      </div>
                      <div className="biz-menu__rowactions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setDraft(toDraft(product))}
                          data-testid={`product-edit-${product.id}`}
                        >
                          ✎ ویرایش
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busy}
                          onClick={() => void removeProduct(product.id)}
                          data-testid={`product-delete-${product.id}`}
                        >
                          حذف
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ))}

          {productForm}
        </div>
      ) : listingKind ? (
        <BusinessListingsManager businessId={id} kind={listingKind} initialListings={data.listings} />
      ) : null}
    </section>
  );
}
