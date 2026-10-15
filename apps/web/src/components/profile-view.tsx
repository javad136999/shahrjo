'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  api,
  getMyFavorites,
  getProfile,
  getTokens,
  logoutServer,
  updateProfile,
} from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { City, MeResponse, MyAdItem } from '@/lib/types';
import { MyAdsList } from './my-ads';

/**
 * Profile page: account info + editable display name and the saved/favorited
 * ads. The ad-submission entry and «آگهی‌های من» deliberately do NOT live here
 * any more — ads are composed and managed from the city wall, so the profile
 * stays an account screen. Operators (non-USER roles) keep a link to the admin
 * panel here, which is the only place it is offered now.
 */
export function ProfileView() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null | undefined>(undefined); // undefined = loading
  const [cityName, setCityName] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<MyAdItem[]>([]);
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getTokens()) {
      router.replace('/login?next=/profile');
      return;
    }
    let alive = true;
    (async () => {
      try {
        const [profile, favs] = await Promise.all([
          getProfile(),
          getMyFavorites(),
        ]);
        if (!alive) return;
        setMe(profile);
        setFullName(profile.fullName ?? '');
        setFavorites(favs);
        if (profile.cityId) {
          api
            .get<City[]>('/cities')
            .then((list) => alive && setCityName(list.find((c) => c.id === profile.cityId)?.name ?? null))
            .catch(() => {});
        }
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiError && err.status === 401) router.replace('/login?next=/profile');
        else setError(err instanceof ApiError ? err.message : 'دریافت اطلاعات پروفایل ناموفق بود');
        setMe(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProfile({ fullName: fullName.trim() });
      setMe(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ذخیره نام ناموفق بود');
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await logoutServer();
    router.replace('/');
    router.refresh();
  };

  if (me === undefined) {
    return (
      <p className="muted loading" aria-busy>
        در حال بارگذاری…
      </p>
    );
  }
  if (me === null) return null;

  return (
    <div className="ad-page">
      <section className="form-card" aria-label="پروفایل من" data-testid="profile-card">
        <h1>پروفایل من</h1>
        <p className="muted small" dir="ltr">
          📞 {me.phone}
        </p>
        <p className="muted small">
          🏙 {cityName ?? (me.hasSelectedCity ? '—' : 'شهر انتخاب نشده')} · عضو از {formatDate(me.createdAt)}
        </p>

        <form onSubmit={saveName} noValidate>
          <label htmlFor="fullName">نام نمایشی</label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            maxLength={80}
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setSaved(false);
            }}
            placeholder="نام شما"
          />
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'در حال ذخیره…' : saved ? 'ذخیره شد ✓' : 'ذخیره نام'}
          </button>
        </form>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="auth-actions">
          {/* ثبت آگهی/لیست آگهی‌های من اینجا نیست — آگهی از دیوار شهر ثبت
              می‌شود و مدیریتِ آن همان‌جاست. پنل مدیریت فقط برای اپراتور. */}
          {me.roles.some((r) => r !== 'USER') && (
            <Link href="/admin" className="btn btn-ghost" data-testid="profile-admin">
              🛡️ پنل مدیریت
            </Link>
          )}
          <button type="button" className="btn btn-ghost" onClick={logout} data-testid="profile-logout">
            خروج از حساب
          </button>
        </div>
      </section>

      <section className="form-card my-ads" aria-label="علاقه‌مندی‌ها">
        <h2>علاقه‌مندی‌ها</h2>
        <MyAdsList items={favorites} emptyText="هنوز آگهی‌ای را ذخیره نکرده‌اید." />
      </section>
    </div>
  );
}
