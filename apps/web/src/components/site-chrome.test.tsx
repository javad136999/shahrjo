import { render, screen } from '@testing-library/react';

const mockPathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

import { SiteChrome } from '@/components/site-chrome';

describe('SiteChrome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.className = '';
  });

  it('shows the site header, footer and nav on a normal page', () => {
    mockPathname.mockReturnValue('/city/sample-city');
    render(
      <SiteChrome>
        <header data-testid="chrome">سربرگ</header>
      </SiteChrome>,
    );
    expect(screen.getByTestId('chrome')).toBeInTheDocument();
    expect(document.body).not.toHaveClass('wall-screen');
  });

  it('drops the site chrome inside the city wall (chat room)', () => {
    mockPathname.mockReturnValue('/wall');
    render(
      <SiteChrome>
        <header data-testid="chrome">سربرگ</header>
      </SiteChrome>,
    );
    expect(screen.queryByTestId('chrome')).toBeNull();
    // and the stylesheet can reclaim the space the bars took
    expect(document.body).toHaveClass('wall-screen');
  });
});
