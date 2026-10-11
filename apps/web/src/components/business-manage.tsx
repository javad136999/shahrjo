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

type Tab = 'info' | 'menu';

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
export function BusinessManage({ id }: { id: number }) {
  const router = useRouter();
  const [data, setData] = useState<ManagedBusiness | null>(null);
  const [categories, setCategories] = useState<BusinessCategoryOption[]>([]);
  const [tab, setTab] = useState<Tab>('info');
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

  const productForm = draft && (
    <form
      className="ad-form biz-product-form"
      data-testid="product-form"
      onSubmit={(e) => {
        e.preventDefault();
        void saveProduct();
      }}
      noValidate
    >
      <h3 className="biz-panel__title">{draft.id === null ? 'افزودن محصول' : 'ویرایش محصول'}</h3>

      <label htmlFor="p-name">نام محصول *</label>
      <input
        id="p-name"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        maxLength={160}
        placeholder="مثلاً لاته"
        required
        data-testid="product-name"
      />

      <div className="biz-form__row">
        <div>
          <label htmlFor="p-section">دستهٔ منو</label>
          <input
            id="p-section"
            list="biz-sections"
            value={draft.section}
            onChange={(e) => setDraft({ ...draft, section: e.target.value })}
            maxLength={80}
            placeholder="مثلاً نوشیدنی"
            data-testid="product-section"
          />
          <datalist id="biz-sections">
            {sections.filter(Boolean).map((section) => (
              <option key={section} value={section} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="p-price">قیمت (ریال) — خالی = توافقی</label>
          <input
            id="p-price"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            inputMode="numeric"
            dir="ltr"
            placeholder="250000"
            data-testid="product-price"
          />
        </div>
      </div>

      <label htmlFor="p-desc">توضیحات — اختیاری</label>
      <textarea
        id="p-desc"
        rows={2}
        value={draft.description}
        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        maxLength={1000}
        data-testid="product-description"
      />

      <label htmlFor="p-image">عکس محصول — اختیاری</label>
      <div className="biz-image">
        {draft.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- owner-uploaded media
          <img
            className="biz-image__thumb"
            src={thumbUrlFor(draft.imageUrl) ?? draft.imageUrl}
            onError={thumbFallback(draft.imageUrl)}
            alt=""
          />
        )}
        <input
          id="p-image"
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          data-testid="product-image"
          onChange={(e) => void pickImage(e.target.files?.[0] ?? null)}
        />
        {draft.imageUrl && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setDraft({ ...draft, imageUrl: '' })}
            data-testid="product-image-remove"
          >
            حذف عکس
          </button>
        )}
      </div>
      {uploading && (
        <p className="muted small" aria-busy>
          در حال بارگذاری تصویر…
        </p>
      )}

      <label className="biz-check">
        <input
          type="checkbox"
          checked={draft.isAvailable}
          onChange={(e) => setDraft({ ...draft, isAvailable: e.target.checked })}
          data-testid="product-available"
        />
        موجود است
      </label>

      <div className="auth-actions">
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
        <h1>{data.name}</h1>
        <Link href={`/business/${data.id}`} className="pill">
          👁 صفحهٔ عمومی
        </Link>
      </header>

      <nav className="biz-tabs" aria-label="بخش‌های مدیریت">
        <button
          type="button"
          className={`biz-tabs__item${tab === 'info' ? ' is-active' : ''}`}
          onClick={() => setTab('info')}
          data-testid="biz-tab-info"
        >
          مشخصات
        </button>
        <button
          type="button"
          className={`biz-tabs__item${tab === 'menu' ? ' is-active' : ''}`}
          onClick={() => setTab('menu')}
          data-testid="biz-tab-menu"
        >
          منو و محصولات ({data.products.length.toLocaleString('fa-IR')})
        </button>
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
          className="ad-form biz-panel"
          data-testid="biz-info-form"
          onSubmit={(e) => {
            e.preventDefault();
            void saveInfo();
          }}
          noValidate
        >
          <label htmlFor="b-name">نام کسب‌وکار *</label>
          <input
            id="b-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={160}
            minLength={2}
            required
            data-testid="biz-name"
          />

          <label htmlFor="b-cat">دسته‌بندی</label>
          <select id="b-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} data-testid="biz-category">
            <option value="">— انتخاب دسته‌بندی —</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.icon ? `${category.icon} ` : ''}
                {category.name}
              </option>
            ))}
          </select>

          <label htmlFor="b-logo">عکس کسب‌وکار — اختیاری</label>
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
              id="b-logo"
              ref={logoRef}
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
              : 'عکس‌ها فشرده ذخیره می‌شوند (WebP ≤۱۰۰۰px) تا فضای سایت پر نشود.'}
          </p>

          <label htmlFor="b-desc">توضیحات — اختیاری</label>
          <textarea
            id="b-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            data-testid="biz-description"
          />

          <label htmlFor="b-phone">شماره تماس — اختیاری</label>
          <input
            id="b-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={15}
            inputMode="tel"
            data-testid="biz-phone"
          />

          <label htmlFor="b-addr">آدرس — اختیاری</label>
          <input
            id="b-addr"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={300}
            data-testid="biz-address"
          />

          <p className="muted small">
            {data.pinned
              ? '📍 موقعیت روی نقشه ثبت شده است.'
              : 'برای نمایش روی نقشهٔ شهر، موقعیت را هنگام ثبت کسب‌وکار انتخاب کن.'}
          </p>

          <button className="btn btn-primary" type="submit" disabled={busy} data-testid="biz-save">
            {busy ? 'در حال ذخیره…' : 'ذخیرهٔ مشخصات'}
          </button>
        </form>
      ) : (
        <div className="biz-panel" data-testid="biz-menu">
          <div className="biz-menu__head">
            <h2 className="biz-panel__title">منو و محصولات</h2>
            <button type="button" className="btn btn-primary" onClick={() => setDraft(emptyDraft())} data-testid="product-new">
              ＋ افزودن محصول
            </button>
          </div>

          {data.products.length === 0 && !draft && (
            <div className="empty-state" data-testid="biz-menu-empty">
              <p>هنوز محصولی ثبت نکرده‌ای. منوی کسب‌وکارت را بساز تا مشتری‌ها در صفحهٔ عمومی ببینند.</p>
            </div>
          )}

          {sections.map((section) => (
            <section key={section || 'none'} className="biz-menu__group" data-testid={`biz-menu-group-${section || 'none'}`}>
              <h3 className="biz-menu__section">{section || 'بدون دسته'}</h3>
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
                          ویرایش
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
      )}
    </section>
  );
}
