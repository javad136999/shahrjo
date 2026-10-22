import { render, screen } from '@testing-library/react';

const mockPathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

import { WebInstallButton } from '@/components/web-install-button';

describe('WebInstallButton', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/dashboard');
    // jsdom has no matchMedia — the component reads the standalone display mode.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() })),
    });
  });

  it('offers the install action on a normal page', () => {
    render(<WebInstallButton />);
    expect(screen.getByRole('button', { name: /نصب نسخه وب/ })).toBeInTheDocument();
  });

  it('stays out of the public city wall (full-screen chat room)', () => {
    mockPathname.mockReturnValue('/wall');
    render(<WebInstallButton />);
    expect(screen.queryByRole('button', { name: /نصب نسخه وب/ })).not.toBeInTheDocument();
  });

  it('stays off the home and city pages too', () => {
    for (const path of ['/', '/city/sample-city']) {
      mockPathname.mockReturnValue(path);
      const { unmount } = render(<WebInstallButton />);
      expect(screen.queryByRole('button', { name: /نصب نسخه وب/ })).not.toBeInTheDocument();
      unmount();
    }
  });

  it('stays off the profile page', () => {
    mockPathname.mockReturnValue('/profile');
    render(<WebInstallButton />);
    expect(screen.queryByRole('button', { name: /نصب نسخه وب/ })).not.toBeInTheDocument();
  });
});
