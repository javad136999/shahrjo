import type { Metadata } from 'next';
import { StaticPage } from '@/components/static-page';

export const metadata: Metadata = {
  title: 'تماس با ما',
  description: 'راه‌های تماس با تیم شهرجو',
};

export default function ContactPage() {
  return (
    <StaticPage title="تماس با ما" lead="شهرجو را توسعه‌دهندگان مستقل می‌سازند؛ بازخورد شما مستقیم به تیم می‌رسد.">
      <p>
        برای پیشنهاد، انتقاد یا گزارش مشکل، از راه‌های زیر استفاده کنید. پشتیبانی کسب‌وکارها و کاربران از همین
        کانال پاسخ داده می‌شود.
      </p>
      <ul className="contact-list">
        <li>
          <strong>پشتیبانی پیامکی:</strong> از داخل پروفایل کاربری، گزارش مشکل ثبت کنید تا با شما تماس بگیریم
        </li>
        <li>
          <strong>کسب‌وکارها:</strong> از طریق پنل کسب‌وکار، تیکت پشتیبانی ثبت کنید
        </li>
        <li>
          <strong>امنیت:</strong> گزارش آسیب‌پذیری را جدی می‌گیریم؛ لطفاً جزئیات را از راه تماس پشتیبانی ارسال
          کنید و اطلاعات کاربران دیگر را منتشر نکنید
        </li>
      </ul>
      <p className="muted">
        شهرجو تابع قوانین جمهوری اسلامی ایران است و محتوای آگهی‌ها پیش از انتشار توسط تیم بررسی می‌شود.
      </p>
    </StaticPage>
  );
}
