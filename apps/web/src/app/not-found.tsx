import Link from 'next/link';

export const metadata = { title: 'صفحه پیدا نشد' };

export default function NotFound() {
  return (
    <section className="auth-card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 44 }} aria-hidden>
        🧭
      </div>
      <h1 style={{ margin: '12px 0 4px' }}>۴۰۴ — صفحه پیدا نشد</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        نشانی واردشده معتبر نیست یا این صفحه حذف شده است.
      </p>
      <div className="auth-actions" style={{ justifyContent: 'center' }}>
        <Link href="/" className="btn btn-primary">
          بازگشت به صفحه اصلی
        </Link>
        <Link href="/ads" className="btn btn-ghost">
          مشاهده آگهی‌ها
        </Link>
      </div>
    </section>
  );
}
