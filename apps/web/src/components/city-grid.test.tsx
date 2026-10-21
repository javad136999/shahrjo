import { render, screen, fireEvent } from '@testing-library/react';
import { CityGrid } from '@/components/city-grid';
import type { City } from '@/lib/types';

const cities: City[] = [
  {
    id: 1,
    name: 'شهر الف',
    slug: 'city-one',
    isFeatured: true,
    latitude: 27.8,
    longitude: 51.9,
    province: { id: 1, name: 'استان نمونه', slug: 'sample-province' },
  },
  {
    id: 2,
    name: 'شهر ب',
    slug: 'city-two',
    isFeatured: false,
    latitude: null,
    longitude: null,
    province: { id: 1, name: 'استان نمونه', slug: 'sample-province' },
  },
  {
    id: 3,
    name: 'شهر ج',
    slug: 'city-three',
    isFeatured: false,
    latitude: null,
    longitude: null,
    province: { id: 2, name: 'استان دیگر', slug: 'other-province' },
  },
];

describe('CityGrid', () => {
  it('sorts city cards alphabetically and shows the province under each city', () => {
    const { container } = render(<CityGrid cities={[cities[2], cities[1], cities[0]]} onSelect={jest.fn()} />);

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('.city-card'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/city/city-one',
      '/city/city-two',
      '/city/city-three',
    ]);
    expect(screen.getByTestId('city-city-three')).toHaveTextContent('استان دیگر');
  });

  it('filters by Persian city/province name and by city slug', () => {
    render(<CityGrid cities={cities} onSelect={jest.fn()} />);
    const search = screen.getByLabelText('جستجوی شهر');

    fireEvent.change(search, { target: { value: 'شهر ب' } });
    expect(screen.getByTestId('city-city-two')).toBeInTheDocument();
    expect(screen.queryByTestId('city-city-one')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'استان دیگر' } });
    expect(screen.getByTestId('city-city-three')).toBeInTheDocument();
    expect(screen.queryByTestId('city-city-two')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'city-three' } });
    expect(screen.getByTestId('city-city-three')).toBeInTheDocument();
  });

  it('shows a helpful empty state when nothing matches', () => {
    render(<CityGrid cities={cities} onSelect={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('جستجوی شهر'), { target: { value: 'ایستگاه' } });

    expect(screen.getByText('شهری با این نام یافت نشد.')).toBeInTheDocument();
    expect(screen.getByTestId('city-results-count')).toHaveTextContent('۰ شهر');
  });

  it('clears the search and restores the full list', () => {
    render(<CityGrid cities={cities} onSelect={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('جستجوی شهر'), { target: { value: 'شهر ب' } });
    fireEvent.click(screen.getByRole('button', { name: 'پاک‌کردن جستجو' }));

    expect(screen.getByTestId('city-city-one')).toBeInTheDocument();
    expect(screen.getByTestId('city-city-two')).toBeInTheDocument();
    expect(screen.getByTestId('city-city-three')).toBeInTheDocument();
    expect(screen.getByTestId('city-results-count')).toHaveTextContent('۳ شهر');
  });

  it('reports selection and marks the current city', () => {
    const onSelect = jest.fn();
    render(<CityGrid cities={cities} onSelect={onSelect} selectedCityId={1} />);

    expect(screen.getByTestId('city-city-one')).toHaveTextContent('✓ انتخاب‌شده');
    expect(screen.getByTestId('city-city-one')).toHaveTextContent('ویژه');

    fireEvent.click(screen.getByTestId('city-city-two'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 2, slug: 'city-two' }));
  });

  it('disables cards while syncing (no navigation mid-sync)', () => {
    const onSelect = jest.fn();
    render(<CityGrid cities={cities} onSelect={onSelect} disabled />);
    const card = screen.getByTestId('city-city-one');

    expect(card).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(card);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
