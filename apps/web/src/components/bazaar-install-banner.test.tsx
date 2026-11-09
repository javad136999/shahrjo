import { act, fireEvent, render, screen } from '@testing-library/react';

const mockPathname = jest.fn();
let standaloneMode = false;

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
    mockPathname.mockReturnValue('/city/jam/services');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jest.fn((query: string) => ({
        matches: standaloneMode && (query.includes('standalone') || query.includes('fullscreen')),
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
    expect(screen.getByRole('link', { name: 'دریافت از بازار' })).toHaveAttribute(
      'href',
      'https://cafebazaar.ir/app/?id=ir.shahrju.app&ref=share',
    );
    expect(screen.getByRole('link', { name: 'دریافت از بازار' })).toHaveAttribute('target', '_blank');
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

  it('does not cover the full-screen city wall', () => {
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
