import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import PrivacyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';
import RootLayout from '@/app/layout';

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeAll(() => {
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
});

const SENSITIVE = /ZARINPAL|MERCH_ANT|MERCHANT_ID|api[_-]?key|localhost:|127\.0\.0\.1|\b\d{16}\b/;

describe('صفحه حریم خصوصی', () => {
  it('عنوان، تاریخ و پوشش بخش‌های الزامی را دارد', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'حریم خصوصی' })).toBeTruthy();
    expect(screen.getByTestId('legal-date').textContent).toContain('آخرین به‌روزرسانی');
    const text = screen.getByTestId('privacy-page').textContent ?? '';
    for (const keyword of ['احراز هویت', 'زرین‌پال', 'پیامک', 'کوکی', 'مدت نگهداری', 'دسترسی، اصلاح', 'تغییرات این سیاست', 'OpenStreetMap']) {
      expect(text).toContain(keyword);
    }
    expect(text).toContain('کوکی استفاده نمی‌شود');
  });

  it('به صفحه تماس پیوند دارد و ادعای اینماد/تأیید هویت ندارد', () => {
    render(<PrivacyPage />);
    const links = screen.getAllByRole('link', { name: /تماس با ما/ });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].getAttribute('href')).toBe('/contact');
    const text = screen.getByTestId('privacy-page').textContent ?? '';
    expect(text).not.toMatch(/اینماد|نماد اعتماد|تأیید هویت رسمی|تأییدشده توسط/);
    expect(text).not.toMatch(SENSITIVE);
  });

  it('وعده حذف فوری یا ابزار حذف خودکار نمی‌دهد', () => {
    render(<PrivacyPage />);
    const text = screen.getByTestId('privacy-page').textContent ?? '';
    expect(text).not.toContain('حذف فوری');
    expect(text).toContain('در صورت امکان فنی');
  });
});

describe('صفحه شرایط استفاده', () => {
  it('عنوان، تاریخ و شرایط پرداخت/اشتراک را بر اساس منطق واقعی دارد', () => {
    render(<TermsPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'شرایط استفاده' })).toBeTruthy();
    expect(screen.getByTestId('legal-date').textContent).toContain('آخرین به‌روزرسانی');
    const text = screen.getByTestId('terms-page').textContent ?? '';
    for (const keyword of ['طلایی', 'نقره‌ای', 'زرین‌پال', 'تأیید موفق پرداخت توسط سرور', 'تأیید مدیر', 'تمدید خودکار وجود ندارد', 'گزارش تخلف', 'بازپرداخت', 'شناسه پیگیری', 'خودکار انجام نمی‌شود', 'CVV2', 'پیش‌نویس']) {
      expect(text).toContain(keyword);
    }
  });

  it('ادعاهای غیرواقعی (تضمین فروش/بازپرداخت قطعی/مهلت رسیدگی) ندارد', () => {
    render(<TermsPage />);
    const text = screen.getByTestId('terms-page').textContent ?? '';
    expect(text).not.toContain('تضمین فروش');
    expect(text).not.toContain('تضمین بازپرداخت');
    expect(text).not.toMatch(/ظرف \d+ روز بازپرداخت/);
    expect(text).not.toMatch(/۷۲\s*ساعت/); // no unbacked refund deadline
    expect(text).not.toMatch(/بازپرداخت خودکار (انجام|می‌شود)/);
    expect(text).not.toMatch(SENSITIVE);
    expect(text).not.toMatch(/اینماد|نماد اعتماد/);
  });

  it('به صفحه تماس پیوند دارد', () => {
    render(<TermsPage />);
    const link = screen.getAllByRole('link', { name: /تماس با ما/ })[0];
    expect(link.getAttribute('href')).toBe('/contact');
  });
});

describe('فوتر سایت', () => {
  it('دقیقاً یک پیوند برای هر یک از حریم خصوصی، شرایط استفاده و تماس با ما دارد', () => {
    render(<RootLayout><div /></RootLayout> as ReactElement);
    const footer = document.querySelector('footer');
    expect(footer).toBeTruthy();
    const f = within(footer as HTMLElement);
    const hrefs = (sel: string) => f.getAllByRole('link', { name: sel }).map((a) => a.getAttribute('href'));
    expect(hrefs('حریم خصوصی')).toEqual(['/privacy']);
    expect(hrefs('شرایط استفاده')).toEqual(['/terms']);
    expect(hrefs('تماس با ما')).toEqual(['/contact']);
  });

  it('includes the official enamad trust seal with the exact id and code', () => {
    render(<RootLayout><div /></RootLayout> as ReactElement);
    const seal = document.querySelector('a[href^="https://trustseal.enamad.ir/"]');
    expect(seal).toBeTruthy();
    const a = seal as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe(
      'https://trustseal.enamad.ir/?id=8111140&Code=u7380vU9WmqBYskeJn9MKLrd0AjOqbPz',
    );
    expect(a.getAttribute('referrerpolicy')).toBe('origin');
    expect(a.getAttribute('target')).toBe('_blank');
    const img = a.querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('src')).toBe(
      'https://trustseal.enamad.ir/logo.aspx?id=8111140&Code=u7380vU9WmqBYskeJn9MKLrd0AjOqbPz',
    );
    expect(img!.getAttribute('referrerpolicy')).toBe('origin');
    expect(img!.getAttribute('code')).toBe('u7380vU9WmqBYskeJn9MKLrd0AjOqbPz');
  });
});
