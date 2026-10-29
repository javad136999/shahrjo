'use client';

import { useState } from 'react';
import { ApiError, createBusinessListing, deleteBusinessListing, updateBusinessListing, uploadBusinessImage, type BusinessListingInput } from '@/lib/api';
import { formatPrice, thumbFallback, thumbUrlFor } from '@/lib/format';
import type { BusinessListingItem } from '@/lib/types';

type Kind = 'PROPERTY' | 'VEHICLE';
type Draft = BusinessListingInput & { id?: number; imageUrls: string[] };

const emptyDraft = (kind: Kind): Draft => ({ kind, title: '', dealType: kind === 'PROPERTY' ? 'SALE' : undefined, description: '', imageUrls: [], isAvailable: true });
const propertyDeal: Record<string, string> = { SALE: 'فروش', RENT: 'اجاره', MORTGAGE_RENT: 'رهن و اجاره' };

function fromItem(item: BusinessListingItem): Draft {
  return {
    kind: item.kind,
    title: item.title,
    dealType: item.dealType ?? undefined,
    description: item.description ?? undefined,
    price: item.price ?? undefined,
    deposit: item.deposit ?? undefined,
    monthlyRent: item.monthlyRent ?? undefined,
    areaM2: item.areaM2 ?? undefined,
    rooms: item.rooms ?? undefined,
    brand: item.brand ?? undefined,
    model: item.model ?? undefined,
    year: item.year ?? undefined,
    mileage: item.mileage ?? undefined,
    color: item.color ?? undefined,
    transmission: item.transmission ?? undefined,
    fuel: item.fuel ?? undefined,
    imageUrls: item.imageUrls ?? [],
    isAvailable: item.isAvailable,
    id: item.id,
  };
}

function numeric(value: string): number | undefined {
  const digits = value.replace(/[^\d۰-۹]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  return digits ? Number(digits) : undefined;
}

export function BusinessListingsManager({ businessId, kind, initialListings }: { businessId: number; kind: Kind; initialListings: BusinessListingItem[] }) {
  const [items, setItems] = useState<BusinessListingItem[]>(initialListings.filter((item) => item.kind === kind));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const update = (patch: Partial<Draft>) => setDraft((current) => current ? { ...current, ...patch } : current);
  const save = async () => {
    if (!draft || draft.title.trim().length < 2) { setError('عنوان فایل را وارد کنید'); return; }
    setBusy(true); setError(null); setNotice(null);
    const { id: _id, ...input } = draft;
    const body: BusinessListingInput = { ...input, title: draft.title.trim() };
    try {
      const saved = draft.id ? await updateBusinessListing(businessId, draft.id, body) : await createBusinessListing(businessId, body);
      setItems((current) => draft.id ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setDraft(null); setNotice(draft.id ? 'فایل به‌روزرسانی شد.' : 'فایل با موفقیت ثبت شد.');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'ذخیرهٔ فایل ناموفق بود'); }
    finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!window.confirm('این فایل حذف شود؟')) return;
    setBusy(true); setError(null);
    try { await deleteBusinessListing(businessId, id); setItems((current) => current.filter((item) => item.id !== id)); setNotice('فایل حذف شد.'); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'حذف فایل ناموفق بود'); }
    finally { setBusy(false); }
  };

  const uploadImages = async (files: FileList | null) => {
    if (!draft || !files?.length) return;
    setUploading(true); setError(null);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 8)) {
        if (file.size > 10 * 1024 * 1024) throw new Error('حجم هر عکس باید حداکثر ۱۰ مگابایت باشد');
        urls.push((await uploadBusinessImage(file)).url);
      }
      update({ imageUrls: [...draft.imageUrls, ...urls] });
    } catch (err) { setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'بارگذاری عکس ناموفق بود'); }
    finally { setUploading(false); }
  };

  const isProperty = kind === 'PROPERTY';
  return (
    <section className="biz-listings" data-testid="business-listings">
      <header className="biz-listings__head">
        <div><h2>{isProperty ? '🏠 فایل‌های املاک' : '🚗 خودروهای اتوگالری'}</h2><p>{isProperty ? 'فایل‌های فروش، رهن و اجاره را مرتب و آمادهٔ تماس مشتری‌ها نگه دار.' : 'خودروها را با عکس کم‌حجم، قیمت و مشخصات کامل به مشتری‌ها معرفی کن.'}</p></div>
        {!draft && <button type="button" className="btn btn-primary" onClick={() => setDraft(emptyDraft(kind))}>＋ افزودن {isProperty ? 'فایل ملک' : 'خودرو'}</button>}
      </header>
      {error && <div className="banner banner--error" role="alert">{error}</div>}
      {notice && <div className="banner banner--ok" role="status">{notice}</div>}
      {draft && (
        <div className="biz-listing-form" data-testid="listing-form">
          <div className="biz-listing-form__grid">
            <label className="biz-field biz-field--wide"><span>{isProperty ? 'عنوان فایل' : 'عنوان خودرو'} *</span><input value={draft.title} maxLength={160} onChange={(e) => update({ title: e.target.value })} placeholder={isProperty ? 'مثلاً آپارتمان ۱۲۰ متری در مرکز شهر' : 'مثلاً پژو ۲۰۷ اتوماتیک'} /></label>
            {isProperty ? <>
              <label className="biz-field"><span>نوع معامله</span><select value={draft.dealType ?? 'SALE'} onChange={(e) => update({ dealType: e.target.value as Draft['dealType'] })}><option value="SALE">فروش</option><option value="RENT">اجاره</option><option value="MORTGAGE_RENT">رهن و اجاره</option></select></label>
              <label className="biz-field"><span>متراژ (متر)</span><input inputMode="numeric" value={draft.areaM2 ?? ''} onChange={(e) => update({ areaM2: numeric(e.target.value) })} /></label>
              <label className="biz-field"><span>تعداد اتاق</span><input inputMode="numeric" value={draft.rooms ?? ''} onChange={(e) => update({ rooms: numeric(e.target.value) })} /></label>
              <label className="biz-field"><span>قیمت فروش / رهن (ریال)</span><input inputMode="numeric" value={draft.price ?? ''} onChange={(e) => update({ price: numeric(e.target.value) })} placeholder="خالی = توافقی" /></label>
              <label className="biz-field"><span>اجارهٔ ماهانه (ریال)</span><input inputMode="numeric" value={draft.monthlyRent ?? ''} onChange={(e) => update({ monthlyRent: numeric(e.target.value) })} /></label>
            </> : <>
              <label className="biz-field"><span>برند</span><input value={draft.brand ?? ''} onChange={(e) => update({ brand: e.target.value })} placeholder="مثلاً ایران‌خودرو" /></label>
              <label className="biz-field"><span>مدل</span><input value={draft.model ?? ''} onChange={(e) => update({ model: e.target.value })} placeholder="مثلاً ۲۰۷ اتوماتیک" /></label>
              <label className="biz-field"><span>سال ساخت</span><input inputMode="numeric" value={draft.year ?? ''} onChange={(e) => update({ year: numeric(e.target.value) })} /></label>
              <label className="biz-field"><span>کارکرد (کیلومتر)</span><input inputMode="numeric" value={draft.mileage ?? ''} onChange={(e) => update({ mileage: numeric(e.target.value) })} /></label>
              <label className="biz-field"><span>قیمت (ریال)</span><input inputMode="numeric" value={draft.price ?? ''} onChange={(e) => update({ price: numeric(e.target.value) })} placeholder="خالی = توافقی" /></label>
              <label className="biz-field"><span>رنگ</span><input value={draft.color ?? ''} onChange={(e) => update({ color: e.target.value })} /></label>
              <label className="biz-field"><span>گیربکس</span><input value={draft.transmission ?? ''} onChange={(e) => update({ transmission: e.target.value })} placeholder="دستی / اتومات" /></label>
              <label className="biz-field"><span>سوخت</span><input value={draft.fuel ?? ''} onChange={(e) => update({ fuel: e.target.value })} placeholder="بنزین / دوگانه" /></label>
            </>}
            <label className="biz-field biz-field--wide"><span>توضیحات و مشخصات</span><textarea rows={4} maxLength={3000} value={draft.description ?? ''} onChange={(e) => update({ description: e.target.value })} placeholder="جزئیات مهم، امکانات، شرایط معامله و راه تماس…" /></label>
            <div className="biz-field biz-field--wide"><span className="biz-field__label">عکس‌ها <small>حداکثر ۸ عکس؛ به‌صورت WebP کم‌حجم ذخیره می‌شوند</small></span><input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(e) => void uploadImages(e.target.files)} />{draft.imageUrls.length > 0 && <div className="biz-listing-form__photos">{draft.imageUrls.map((url, index) => <span key={`${url}-${index}`}><img src={thumbUrlFor(url) ?? url} onError={thumbFallback(url)} alt="" /><button type="button" onClick={() => update({ imageUrls: draft.imageUrls.filter((_, i) => i !== index) })}>×</button></span>)}</div>}</div>
          </div>
          <label className="biz-availability"><input type="checkbox" checked={draft.isAvailable !== false} onChange={(e) => update({ isAvailable: e.target.checked })} /><span><b>{isProperty ? 'فایل فعال و قابل نمایش است' : 'خودرو موجود و قابل نمایش است'}</b><small>با خاموش‌کردن، فایل از صفحهٔ عمومی پنهان می‌شود.</small></span></label>
          <div className="biz-editor__actions"><button type="button" className="btn btn-primary" disabled={busy || uploading} onClick={() => void save()}>{busy ? 'در حال ذخیره…' : 'ذخیرهٔ فایل'}</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setDraft(null)}>انصراف</button></div>
        </div>
      )}
      {!draft && items.length === 0 && <div className="empty-state"><span className="empty-state__icon">{isProperty ? '🏠' : '🚗'}</span><p>هنوز {isProperty ? 'فایلی' : 'خودرویی'} ثبت نکرده‌ای.</p><small>با افزودن اطلاعات و عکس، صفحهٔ عمومی کسب‌وکارت را کامل کن.</small></div>}
      {!draft && items.length > 0 && <div className="biz-listings__grid">{items.map((item) => <article className={`biz-listing-card${item.isAvailable ? '' : ' is-muted'}`} key={item.id}>{item.imageUrls[0] ? <img src={thumbUrlFor(item.imageUrls[0]) ?? item.imageUrls[0]} onError={thumbFallback(item.imageUrls[0])} alt="" /> : <div className="biz-listing-card__placeholder">{isProperty ? '🏠' : '🚗'}</div>}<div className="biz-listing-card__body"><div className="biz-listing-card__title"><b>{item.title}</b>{isProperty && item.dealType && <span className="chip">{propertyDeal[item.dealType]}</span>}</div><p>{isProperty ? [item.areaM2 && `${item.areaM2} متر`, item.rooms && `${item.rooms} اتاق`].filter(Boolean).join(' · ') : [item.brand, item.model, item.year && `مدل ${item.year}`].filter(Boolean).join(' · ')}</p><strong>{formatPrice(item.price)}{item.monthlyRent ? ` · ماهانه ${formatPrice(item.monthlyRent)}` : ''}</strong>{!item.isAvailable && <span className="badge badge--rose">غیرفعال</span>}<div className="biz-listing-card__actions"><button type="button" className="btn btn-ghost" onClick={() => setDraft(fromItem(item))}>✎ ویرایش</button><button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void remove(item.id)}>حذف</button></div></div></article>)}</div>}
    </section>
  );
}
