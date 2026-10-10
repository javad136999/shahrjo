import type { Metadata } from 'next';
import Link from 'next/link';
import { BottomNav } from '@/components/bottom-nav';
import { HeaderActions } from '@/components/header-actions';
import { HeaderPills } from '@/components/header-pills';
import { VisitBeacon } from '@/components/visit-beacon';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shahrjo.ir'),
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
            <HeaderPills />
            <HeaderActions />
          </div>
        </header>
        <main className="container page">{children}</main>
        <footer className="site-footer">
          <div className="container">شهرجو — پلتفرم شهری چندشهری 🇮🇷</div>
        </footer>
        <BottomNav />
        <VisitBeacon />
      </body>
    </html>
  );
}
