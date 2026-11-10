import { act, fireEvent, render, screen } from '@testing-library/react';

const mockPathname = jest.fn();
let standaloneMode = false;
let fullscreenMode = false;

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

import { BazaarInstallBanner } from '@/components/bazaar-install-banner';

describe('BazaarInstallBanner', () => {
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    localStorage.clear();
    standaloneMode = false;
    fullscreenMode = false;
    mockPathname.mockReturnValue('/city/jam/services');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jest.fn((query: string) => ({
        matches: (standaloneMode && query.includes('standalone')) || (fullscreenMode && query.includes('fullscreen')),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: originalUserAgent });
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: originalUserAgent });
  });

  it('shows a delayed Bazaar install link on browser pages', () => {
    render(<BazaarInstallBanner />);
    expect(screen.queryByTestId('bazaar-install-banner')).not.toBeInTheDocument();

    act(() => jest.advanceTimersByTime(6_000));

    expect(screen.getByTestId('bazaar-install-banner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'دانلود از بازار' })).toHaveAttribute(
      'href',
      'https://cafebazaar.ir/app/?id=ir.shahrju.app&ref=share',
    );
    expect(screen.getByRole('link', { name: 'دانلود از بازار' })).toHaveAttribute('target', '_blank');
  });

  it('never shows inside the installed PWA', () => {
    standaloneMode = true;
    render(<BazaarInstallBanner />);
    act(() => jest.advanceTimersByTime(6_000));
    expect(screen.queryByTestId('bazaar-install-banner')).not.toBeInTheDocument();
  });

  it('never shows inside the installed Android WebView', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 Version/4.0 Chrome/120.0 Mobile Safari/537.36',
    });
    render(<BazaarInstallBanner />);
    act(() => jest.advanceTimersByTime(6_000));
    expect(screen.queryByTestId('bazaar-install-banner')).not.toBeInTheDocument();
  });

  it('shows quickly in Instagram even when its Android browser reports fullscreen on the city wall', () => {
    fullscreenMode = true;
    mockPathname.mockReturnValue('/wall');
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 Version/4.0 Chrome/120.0 Instagram 350.0.0.0 Mobile Safari/537.36',
    });
    render(<BazaarInstallBanner />);

    act(() => jest.advanceTimersByTime(2_000));

    expect(screen.getByText('کاربر عزیز، به سایت شهرجو خوش آمدید')).toBeInTheDocument();
    expect(screen.getByText('جهت دانلود اپلیکیشن از لینک زیر اقدام نمایید')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'دانلود از بازار' })).toHaveAttribute(
      'href',
      'https://cafebazaar.ir/app/?id=ir.shahrju.app&ref=share',
    );
  });

  it('does not cover the full-screen city wall in a regular browser', () => {
    mockPathname.mockReturnValue('/wall');
    render(<BazaarInstallBanner />);
    act(() => jest.advanceTimersByTime(6_000));
    expect(screen.queryByTestId('bazaar-install-banner')).not.toBeInTheDocument();
  });

  it('remembers dismissal for seven days', () => {
    const first = render(<BazaarInstallBanner />);
    act(() => jest.advanceTimersByTime(6_000));
    fireEvent.click(screen.getByRole('button', { name: 'بستن معرفی نصب' }));
    expect(screen.queryByTestId('bazaar-install-banner')).not.toBeInTheDocument();
    first.unmount();

    render(<BazaarInstallBanner />);
    act(() => jest.advanceTimersByTime(6_000));
    expect(screen.queryByTestId('bazaar-install-banner')).not.toBeInTheDocument();
  });
});
