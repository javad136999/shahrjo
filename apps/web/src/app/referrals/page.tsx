'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, getReferralSummary, getTokens, type ReferralSummary } from '@/lib/api';

export default function ReferralsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!getTokens()) {
      router.replace('/login?next=/referrals');
      return;
    }
    let active = true;
    getReferralSummary()
      .then((data) => active && setSummary(data))
      .catch((err: unknown) => active && setError(err instanceof ApiError ? err.message : 'دریافت اطلاعات معرفی ممکن نشد'))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [router]);

  const inviteLink = useMemo(() => summary && typeof window !== 'undefined'
    ? `${window.location.origin}/login?ref=${encodeURIComponent(summary.code)}`
    : '', [summary]);

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError('کپی خودکار ممکن نشد؛ لینک را انتخاب و کپی کنید.');
    }
  };

  const shareLink = async () => {
    if (!inviteLink) return;
    const text = `با شهرجو، کسب‌وکارها و خدمات شهر خودت را پیدا کن: ${inviteLink}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'معرفی شهرجو', text, url: inviteLink }); } catch { /* user cancelled */ }
    } else {
      await copyLink();
    }
  };

  if (busy) return <p className="muted loading" aria-busy="true">در حال آماده‌سازی معرفی شهرجو…</p>;
  if (!summary) return <div className="ad-page"><div className="banner banner--error" role="alert">{error ?? 'برای استفاده از این بخش وارد حساب شوید.'}</div><Link href="/login?next=/referrals" className="btn btn-primary">ورود به حساب</Link></div>;

  const next = summary.milestones.find((milestone) => !milestone.achieved);
  const progress = next ? Math.min(100, Math.round(summary.successfulSignups / next.count * 100)) : 100;
  return (
    <div className="ad-page" data-testid="referrals-page">
      <Link href="/" className="back-link">← بازگشت به شهرجو</Link>
      <section className="plans-hero">
        <span className="icon-tile icon-tile--lg" aria-hidden>↗</span>
        <div><h1>معرفی شهرجو، جایزه بگیر</h1><p className="muted">لینک اختصاصی‌ات را برای دوستان و اقوام بفرست. هر عضویت جدید با این لینک، در شمارش پاداش‌ها ثبت می‌شود.</p></div>
      </section>

      <section className="form-card" aria-label="لینک دعوت">
        <h2>لینک اختصاصی شما</h2>
        <p className="muted small">کد دعوت: <b dir="ltr">{summary.code}</b></p>
        <label htmlFor="invite-link">لینک معرفی را کپی یا در شبکه‌های اجتماعی منتشر کن</label>
        <input id="invite-link" readOnly dir="ltr" value={inviteLink} onFocus={(event) => event.currentTarget.select()} />
        <div className="auth-actions">
          <button type="button" className="btn btn-primary" onClick={copyLink}>{copied ? 'کپی شد ✓' : 'کپی لینک'}</button>
          <button type="button" className="btn btn-ghost" onClick={shareLink}>اشتراک‌گذاری</button>
          <a className="btn btn-ghost" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`با شهرجو، کسب‌وکارها و خدمات شهر خودت را پیدا کن: ${inviteLink}`)}`}>ارسال در واتساپ</a>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      <section className="form-card" aria-label="پیشرفت دعوت‌ها">
        <h2>پیشرفت شما</h2>
        <p className="muted">تعداد اعضای جدیدی که با کد شما ثبت‌نام کرده‌اند: <strong>{summary.successfulSignups}</strong></p>
        {next && <><p className="small">تا جایزه بعدی: {Math.max(0, next.count - summary.successfulSignups)} عضو دیگر</p><progress max="100" value={progress} aria-label="پیشرفت تا جایزه بعدی" /></>}
        {summary.milestones.map((milestone) => (
          <article key={milestone.count} className="referral-reward" data-testid={`referral-milestone-${milestone.count}`}>
            <div><h3>{milestone.count} عضو</h3><p>{milestone.title}</p><small className="muted">ارزش اعلام‌شده: {milestone.valueToman.toLocaleString('fa-IR')} تومان</small></div>
            <span className={milestone.achieved ? 'chip referral-reward__earned' : 'chip'}>{milestone.achieved ? 'شرط تکمیل شد' : `${milestone.remaining} نفر مانده`}</span>
          </article>
        ))}
        <p className="muted small">اشتراک کسب‌وکار پس از بررسی و انتخاب کسب‌وکارِ متعلق به شما فعال می‌شود. پرداخت نقدیِ جایزه ۱۰۰ نفره پس از تأیید مدیر و ثبت اطلاعات پرداخت انجام می‌شود؛ این صفحه انتقال وجه خودکار انجام نمی‌دهد.</p>
        <Link href="/businesses" className="btn btn-ghost">دیدن کسب‌وکارها و منوها</Link>
      </section>
    </div>
  );
}
