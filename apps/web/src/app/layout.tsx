import type { Metadata } from 'next';
import Link from 'next/link';
import { HeaderActions } from '@/components/header-actions';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'شهرجو | همه‌چیز شهر شما',
    template: '%s | شهرجو',
  },
  description: 'شهرجو؛ اخبار، آگهی‌ها و کسب‌وکارهای شهر شما — پلتفرم چندشهری ایرانی',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden>
                🏙
              </span>
              شهرجو
            </Link>
            <HeaderActions />
          </div>
        </header>
        <main className="container page">{children}</main>
        <footer className="site-footer">
          <div className="container">شهرجو — پلتفرم شهری چندشهری 🇮🇷</div>
        </footer>
      </body>
    </html>
  );
}
