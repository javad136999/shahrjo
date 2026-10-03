import { render, screen } from '@testing-library/react';

const mockGetLocalCity = jest.fn();

jest.mock('@/lib/api', () => ({
  getLocalCity: () => mockGetLocalCity(),
}));

import { HeaderPills } from '@/components/header-pills';

describe('HeaderPills', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLocalCity.mockReturnValue({ id: 5, slug: 'sample-city', name: 'شهر نمونه' });
  });

  it('links to the remembered city once read client-side', async () => {
    render(<HeaderPills />);
    const pill = await screen.findByTestId('header-city-pill');
    expect(pill).toHaveAttribute('href', '/city/sample-city');
    expect(pill).toHaveTextContent('شهر نمونه');
  });

  it('asks for a city selection when none is remembered', async () => {
    mockGetLocalCity.mockReturnValue(null);
    render(<HeaderPills />);
    const pill = await screen.findByTestId('header-city-pill');
    expect(pill).toHaveAttribute('href', '/');
    expect(pill).toHaveTextContent('انتخاب شهر');
  });

  it('always offers the ad submission entry', async () => {
    render(<HeaderPills />);
    expect(await screen.findByTestId('header-submit-pill')).toHaveAttribute('href', '/ads/new');
    expect(screen.getByTestId('header-submit-pill')).toHaveTextContent('ثبت آگهی');
  });

  it('shows the dedicated city-selection icon whenever a city is remembered', async () => {
    render(<HeaderPills />);
    await screen.findByTestId('header-city-pill');
    const select = screen.getByTestId('header-city-select');
    expect(select).toHaveAttribute('href', '/');
    expect(select).toHaveAccessibleName('انتخاب شهر');
  });

  it('drops the redundant icon when no city is remembered', async () => {
    mockGetLocalCity.mockReturnValue(null);
    render(<HeaderPills />);
    await screen.findByTestId('header-city-pill');
    expect(screen.queryByTestId('header-city-select')).not.toBeInTheDocument();
  });
});
