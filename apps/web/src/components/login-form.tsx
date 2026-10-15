'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError, api, sendOtp, setLocalCity, verifyOtp } from '@/lib/api';
import type { City, MeResponse } from '@/lib/types';

const IRANIAN_MOBILE = /^09\d{9}$/;
const OTP_CODE = /^\d{4,8}$/;

type Step = 'phone' | 'code';

/** Phone + SMS-OTP login (Phase 2 backend). */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  /** How long the code is — auto-submit fires the moment the field is full. */
  const [codeLength, setCodeLength] = useState(5);
  const codeRef = useRef<HTMLInputElement>(null);
  /** State updates lag behind events — a ref stops a double login race. */
  const submitting = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submitPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = phone.trim();
    if (!IRANIAN_MOBILE.test(p)) {
      setError('شماره موبایل معتبر وارد کنید (مثال: 09123456789)');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await sendOtp(p);
      setStep('code');
      setCooldown(res.cooldownSeconds ?? 0);
      setCodeLength(res.codeLength ?? 5);
      if (res.autoFillCode) {
        // The code never left the server (console SMS provider): fill it and
        // log the user in — no typing, no second tap.
        setCode(res.autoFillCode);
        setTimeout(() => void doLogin(res.autoFillCode as string), 0);
      } else {
        // focus the code input after the step switch renders (the browser can
        // then autofill it straight from the incoming SMS)
        setTimeout(() => codeRef.current?.focus(), 0);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ارسال کد با خطا مواجه شد');
    } finally {
      setBusy(false);
    }
  };

  /** The actual login — called by the button, by autofill/paste (field full)
   *  and by the auto-filled console code. */
  const doLogin = async (raw: string) => {
    if (submitting.current) return;
    const c = raw.trim();
    if (!OTP_CODE.test(c)) {
      setError('کد ۴ تا ۸ رقمی را وارد کنید');
      return;
    }
    submitting.current = true;
    setError(null);
    setBusy(true);
    try {
      await verifyOtp(phone.trim(), c);
      // به محض ورود: اگر next نداریم، مستقیم به شهر خودِ کاربر برو (وگرنه انتخاب شهر)
      let target: string | null = next && next.startsWith('/') ? next : null;
      if (!target) {
        try {
          const me = await api.get<MeResponse>('/users/me');
          if (me.cityId) {
            const cities = await api.get<City[]>('/cities');
            const city = cities.find((c) => c.id === me.cityId);
            if (city) {
              setLocalCity({ id: city.id, slug: city.slug, name: city.name });
              target = `/city/${city.slug}`;
            }
          }
        } catch {
          // بدون پروفایل/شهر → صفحه انتخاب شهر
        }
      }
      router.push(target ?? '/');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'کد نامعتبر است');
      setBusy(false);
      submitting.current = false;
    }
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    void doLogin(code);
  };

  /** Typing / pasting / SMS autofill all land here: a full code logs in by itself. */
  const onCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    setCode(digits);
    setError(null);
    if (digits.length >= codeLength) void doLogin(digits);
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await sendOtp(phone.trim());
      setCooldown(res.cooldownSeconds ?? 0);
      setCodeLength(res.codeLength ?? 5);
      // a fresh code arrives the same way: fill + auto-login (console provider)
      if (res.autoFillCode) {
        setCode(res.autoFillCode);
        setTimeout(() => void doLogin(res.autoFillCode as string), 0);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ارسال مجدد کد با خطا مواجه شد');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card">
      {step === 'phone' ? (
        <form onSubmit={submitPhone} noValidate>
          <h1>ورود به شهرجو</h1>
          <p className="muted">شماره موبایل خود را وارد کنید؛ کد تأیید پیامک می‌شود.</p>
          <p className="legal-inline-links">
            برای آگاهی:{' '}
            <Link href="/terms">شرایط استفاده</Link>
            <span aria-hidden="true"> · </span>
            <Link href="/privacy">حریم خصوصی</Link>
          </p>
          <label htmlFor="phone">شماره موبایل</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="09xxxxxxxxx"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'در حال ارسال…' : 'ارسال کد تأیید'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} noValidate>
          <h1>کد تأیید</h1>
          <p className="muted" dir="ltr">
            کد برای <strong>{phone}</strong> ارسال شد
          </p>
          <label htmlFor="code">کد تأیید</label>
          <input
            id="code"
            name="code"
            ref={codeRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={8}
            placeholder="12345"
            dir="ltr"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            required
          />
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'در حال بررسی…' : 'ورود'}
          </button>
          <div className="auth-actions">
            <button type="button" className="btn btn-ghost" onClick={resend} disabled={cooldown > 0 || busy}>
              {cooldown > 0 ? `ارسال مجدد (${cooldown})` : 'ارسال مجدد کد'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setStep('phone'); setError(null); }}>
              ویرایش شماره
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
