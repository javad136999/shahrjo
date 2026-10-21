'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  getMyBusinesses,
  getPlans,
  getReferralSummary,
  getTokens,
  redeemReferralCredit,
  type ReferralSummary,
} from '@/lib/api';
import type { MyBusiness, PlanItem } from '@/lib/types';

const toman = (value: number) => `${Math.round(value).toLocaleString('fa-IR')} تومان`;
const tomanFromRial = (value: number) => toman(value / 10);

export default function ReferralsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [businesses, setBusinesses] = useState<MyBusiness[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [businessId, setBusinessId] = useState('');
  const [planId, setPlanId] = useState('');

  useEffect(() => {
    if (!getTokens()) {
      router.replace('/login?next=/referrals');
      return;
    }
    let active = true;
    void Promise.allSettled([getReferralSummary(), getMyBusinesses(), getPlans()])
      .then(([summaryResult, businessesResult, plansResult]) => {
        if (!active) return;
        if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
        else setError(summaryResult.reason instanceof ApiError ? summaryResult.reason.message : 'دریافت اطلاعات معرفی ممکن نشد');
        if (businessesResult.status === 'fulfilled') {
          const eligible = businessesResult.value.filter((business) => ['PENDING', 'APPROVED', 'CLOSED'].includes(business.status));
          setBusinesses(eligible);
          if (eligible[0]) setBusinessId(String(eligible[0].id));
        }
        if (plansResult.status === 'fulfilled') {
          const paid = plansResult.value.filter((plan) => plan.tier !== 'FREE' && plan.price > 0);
          setPlans(paid);
          if (paid[0]) setPlanId(String(paid[0].id));
        }
      })
      .catch(() => { if (active) setError('دریافت اطلاعات معرفی ممکن نشد'); })
      .finally(() => { if (active) setBusy(false); });
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

  const redeem = async () => {
    if (!businessId || !planId || !summary) return;
    setRedeeming(true);
    setRedeemMessage(null);
    try {
      const result = await redeemReferralCredit({ businessId: Number(businessId), planId: Number(planId) });
      setRedeemMessage(`اشتراک کسب‌وکار فعال شد. ${tomanFromRial(result.redeemedRial)} اعتبار مصرف شد.`);
      setSummary(await getReferralSummary());
    } catch (err) {
      setRedeemMessage(err instanceof ApiError ? err.message : 'مصرف اعتبار انجام نشد؛ دوباره تلاش کنید.');
    } finally {
      setRedeeming(false);
    }
  };

  if (busy) return <p className="muted loading" aria-busy="true">در حال آماده‌سازی معرفی شهرجو…</p>;
  if (!summary) return <div className="ad-page"><div className="banner banner--error" role="alert">{error ?? 'برای استفاده از این بخش وارد حساب شوید.'}</div><Link href="/login?next=/referrals" className="btn btn-primary">ورود به حساب</Link></div>;

  const next = summary.milestones.find((milestone) => !milestone.achieved);
  const progress = next ? Math.min(100, Math.round(summary.successfulSignups / next.count * 100)) : 100;
  const selectedPlan = plans.find((plan) => plan.id === Number(planId));
  const canRedeem = Boolean(
    businessId && selectedPlan && selectedPlan.price <= summary.balanceRial && !redeeming,
  );

  return (
    <div className="ad-page" data-testid="referrals-page">
      <Link href="/" className="back-link">← بازگشت به شهرجو</Link>
      <section className="plans-hero">
        <span className="icon-tile icon-tile--lg" aria-hidden>🎁</span>
        <div><h1>معرفی کن، جایزه ببر</h1><p className="muted">دوستانت با لینک شما ثبت‌نام کنند و وارد شهرجو شوند؛ با رسیدن به سقف‌های معرفی، اعتبار فعال‌سازی کسب‌وکار بگیر.</p></div>
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

      <section className="form-card referral-wallet" aria-label="کیف اعتبار معرفی">
        <h2>اعتبار فعال‌سازی کسب‌وکار</h2>
        <p className="referral-wallet__balance" data-testid="referral-credit-balance">{tomanFromRial(summary.balanceRial)}</p>
        <p className="muted small">این اعتبار پول نقد نیست، قابل برداشت یا انتقال نیست و فقط برای فعال‌کردن اشتراک کسب‌وکارهای خودتان در شهرجو مصرف می‌شود.</p>
        {businesses.length === 0 ? (
          <div><p className="muted">برای مصرف اعتبار، ابتدا یک کسب‌وکار در حساب خود ثبت کنید.</p><Link href="/business/new" className="btn btn-primary">ثبت کسب‌وکار</Link></div>
        ) : plans.length === 0 ? (
          <p className="muted">در حال حاضر پلن قابل‌فعال‌سازی موجود نیست.</p>
        ) : (
          <div className="form-grid">
            <label htmlFor="referral-business">کسب‌وکار شما
              <select id="referral-business" value={businessId} onChange={(event) => setBusinessId(event.target.value)}>
                {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
              </select>
            </label>
            <label htmlFor="referral-plan">اشتراک برای فعال‌سازی
              <select id="referral-plan" value={planId} onChange={(event) => setPlanId(event.target.value)}>
                {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.tier === 'GOLD' ? 'طلایی' : 'نقره‌ای'} — {plan.label} — {tomanFromRial(plan.price)}</option>)}
              </select>
            </label>
            {selectedPlan && <p className="muted small">هزینهٔ این پلن: {tomanFromRial(selectedPlan.price)}{selectedPlan.price > summary.balanceRial ? `؛ ${tomanFromRial(selectedPlan.price - summary.balanceRial)} اعتبار دیگر لازم دارید.` : '؛ موجودی شما کافی است.'}</p>}
            <button type="button" className="btn btn-primary" onClick={() => void redeem()} disabled={!canRedeem}>
              {redeeming ? 'در حال فعال‌سازی…' : 'فعال‌سازی با اعتبار معرفی'}
            </button>
          </div>
        )}
        {redeemMessage && <p className="banner banner--ok" role="status">{redeemMessage}</p>}
      </section>

      <section className="form-card" aria-label="پیشرفت دعوت‌ها">
        <h2>پیشرفت شما</h2>
        <p className="muted">تعداد افرادی که با کد شما ثبت‌نام کرده و وارد شهرجو شده‌اند: <strong>{summary.successfulSignups}</strong></p>
        {next && <><p className="small">تا اعتبار تجمعی بعدی: {Math.max(0, next.count - summary.successfulSignups)} عضو دیگر</p><progress max="100" value={progress} aria-label="پیشرفت تا اعتبار بعدی" /></>}
        {summary.milestones.map((milestone) => (
          <article key={milestone.count} className="referral-reward" data-testid={`referral-milestone-${milestone.count}`}>
            <div><h3>{milestone.count} عضو موفق</h3><p>{milestone.title}</p><small className="muted">موجودی تجمعی در این سقف: {toman(milestone.valueToman)}{milestone.incrementalToman < milestone.valueToman ? ` — اعتبار افزوده‌شده در این سقف: ${toman(milestone.incrementalToman)}` : ''}</small></div>
            <span className={milestone.achieved ? 'chip referral-reward__earned' : 'chip'}>{milestone.achieved ? 'اعتبار ثبت شد' : `${milestone.remaining} نفر مانده`}</span>
          </article>
        ))}
        <p className="muted small">اعتبار هر سقف فقط یک‌بار و به‌صورت مابه‌التفاوت به موجودی اضافه می‌شود. پاداش سقف ۱۰۰ نفر نیز اعتبار فعال‌سازی است و هیچ پرداخت نقدی ندارد.</p>
        <Link href="/businesses" className="btn btn-ghost">دیدن کسب‌وکارها و منوها</Link>
      </section>
    </div>
  );
}
