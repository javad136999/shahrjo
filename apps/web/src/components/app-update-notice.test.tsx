import { act, render, screen } from '@testing-library/react';
import { AppUpdateNotice } from '@/components/app-update-notice';

describe('AppUpdateNotice', () => {
  const originalUserAgent = window.navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: originalUserAgent });
    delete (window as Window & { __SHAHRJO_APP_VERSION__?: string }).__SHAHRJO_APP_VERSION__;
  });

  function setUserAgent(userAgent: string) {
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: userAgent });
  }

  it('shows a Bazaar update link to an older Android app WebView', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel; wv) Version/4.0 Chrome/130.0 Mobile Safari/537.36 ShahrjoApp/1.0.0');
    render(<AppUpdateNotice />);

    const notice = await screen.findByTestId('app-update-notice');
    expect(notice).toHaveTextContent('نسخهٔ جدید شهرجو آماده است.');
    expect(screen.getByTestId('app-update-link')).toHaveAttribute('href', 'https://cafebazaar.ir/app/ir.shahrju.app');
  });

  it('hides the notice automatically after the current app version is installed', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel; wv) Version/4.0 Chrome/130.0 Mobile Safari/537.36 ShahrjoApp/1.0.10');
    render(<AppUpdateNotice />);

    expect(screen.queryByTestId('app-update-notice')).not.toBeInTheDocument();
  });

  it('hides the notice when the current app reports its version natively', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel; wv) Version/4.0 Chrome/130.0 Mobile Safari/537.36');
    (window as Window & { __SHAHRJO_APP_VERSION__?: string }).__SHAHRJO_APP_VERSION__ = '1.0.10';
    render(<AppUpdateNotice />);

    expect(screen.queryByTestId('app-update-notice')).not.toBeInTheDocument();
  });

  it('rechecks and hides the prompt if the native version arrives after page hydration', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel; wv) Version/4.0 Chrome/130.0 Mobile Safari/537.36 ShahrjoApp/1.0.9');
    render(<AppUpdateNotice />);
    expect(screen.getByTestId('app-update-notice')).toBeInTheDocument();

    act(() => {
      (window as Window & { __SHAHRJO_APP_VERSION__?: string }).__SHAHRJO_APP_VERSION__ = '1.0.10';
      window.dispatchEvent(new Event('shahrjo:app-version'));
    });

    expect(screen.queryByTestId('app-update-notice')).not.toBeInTheDocument();
  });

  it('does not show a false prompt when an Android WebView does not report its version', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel; wv) Version/4.0 Chrome/130.0 Mobile Safari/537.36');
    render(<AppUpdateNotice />);
    expect(screen.queryByTestId('app-update-notice')).not.toBeInTheDocument();
  });

  it('does not display the in-app notice in a normal mobile browser', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36');
    render(<AppUpdateNotice />);

    expect(screen.queryByTestId('app-update-notice')).not.toBeInTheDocument();
  });
});
