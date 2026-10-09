import type { Metadata } from 'next';
import Link from 'next/link';
import { BottomNav } from '@/components/bottom-nav';
import { HeaderActions } from '@/components/header-actions';
import { HeaderPills } from '@/components/header-pills';
import { VisitBeacon } from '@/components/visit-beacon';
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
            <HeaderPills />
            <HeaderActions />
          </div>
        </header>
        <main className="container page">{children}</main>
        <footer className="site-footer">
          <div className="container footer-inner">
            <span>شهرجو — پلتفرم شهری چندشهری 🇮🇷</span>
            <Link href="/contact" className="footer-link" data-testid="footer-contact">
              تماس با ما
            </Link>
            <Link href="/privacy">حریم خصوصی</Link>
            <Link href="/terms">شرایط استفاده</Link>
          </div>
          <div className="container footer-trust" aria-label="نمادهای اعتماد">
            <a
              referrerPolicy="origin"
              target="_blank"
              rel="noopener noreferrer"
              href="https://trustseal.enamad.ir/?id=8111140&Code=u7380vU9WmqBYskeJn9MKLrd0AjOqbPz"
              aria-label="نماد اعتماد الکترونیکی"
              data-testid="footer-enamad"
              {...{ code: 'u7380vU9WmqBYskeJn9MKLrd0AjOqbPz' }}
            >
              <img
                referrerPolicy="origin"
                src="https://trustseal.enamad.ir/logo.aspx?id=8111140&Code=u7380vU9WmqBYskeJn9MKLrd0AjOqbPz"
                alt=""
                style={{ cursor: 'pointer' }}
                {...{ code: 'u7380vU9WmqBYskeJn9MKLrd0AjOqbPz' }}
              />
            </a>
          </div>
        </footer>
        <BottomNav />
        <VisitBeacon />
      </body>
    </html>
  );
}
