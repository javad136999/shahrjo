import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { BottomNav } from '@/components/bottom-nav';
import { HeaderActions } from '@/components/header-actions';
import { HeaderPills } from '@/components/header-pills';
import { SiteChrome } from '@/components/site-chrome';
import { VisitBeacon } from '@/components/visit-beacon';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shahrjo.ir'),
  title: {
    default: 'شهرجو | همه‌چیز شهر شما',
    template: '%s | شهرجو',
  },
  description: 'شهرجو؛ اخبار، آگهی‌ها و کسب‌وکارهای شهر شما — پلتفرم چندشهری ایرانی',
  applicationName: 'شهرجو',
  manifest: '/site.webmanifest',
  // The `?v=2` suffix busts whatever the previous icon set cached under the
  // same filename — without it browsers keep serving the old favicon for the
  // length of its max-age even though the bytes changed on disk.
  icons: {
    icon: [
      { url: '/favicon-16x16.png?v=2', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png?v=2', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon-32x32.png?v=2',
    apple: '/apple-touch-icon.png?v=2',
    // The maskable variants are deliberately NOT listed here: `purpose` is a
    // manifest-only concept, and Next's IconDescriptor has no such field. A
    // full-bleed maskable bitmap also looks wrong as a plain tab icon. Chrome
    // and Android read them from site.webmanifest, where they are declared.
    other: [
      { url: '/icon-192x192.png?v=2', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png?v=2', sizes: '512x512', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'شهرجو',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    siteName: 'شهرجو',
    title: 'شهرجو | همه‌چیز شهر شما',
    description: 'شهرجو؛ اخبار، آگهی‌ها و کسب‌وکارهای شهر شما',
    images: [{ url: '/icon-512x512.png?v=2', width: 512, height: 512, alt: 'لوگوی شهرجو' }],
  },
  twitter: {
    card: 'summary',
    title: 'شهرجو | همه‌چیز شهر شما',
    description: 'شهرجو؛ اخبار، آگهی‌ها و کسب‌وکارهای شهر شما',
    images: ['/icon-512x512.png?v=2'],
  },
};

export const viewport: Viewport = {
  themeColor: '#014934',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        {/* Site frame: hidden on full-screen rooms (the city wall chat room). */}
        <SiteChrome>
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
        </SiteChrome>
        <main className="container page">{children}</main>
        <SiteChrome>
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
        </SiteChrome>
        <VisitBeacon />
      </body>
    </html>
  );
}
