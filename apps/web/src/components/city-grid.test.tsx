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
  it('groups cities under their province headings', () => {
    render(<CityGrid cities={cities} onSelect={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'استان نمونه' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'استان دیگر' })).toBeInTheDocument();
    expect(screen.getByTestId('city-city-one')).toBeInTheDocument();
    expect(screen.getByTestId('city-city-two')).toBeInTheDocument();
  });

  it('filters by Persian name and by slug', () => {
    render(<CityGrid cities={cities} onSelect={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('جستجوی شهر'), { target: { value: 'شهر ب' } });
    expect(screen.getByTestId('city-city-two')).toBeInTheDocument();
    expect(screen.queryByTestId('city-city-one')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('جستجوی شهر'), { target: { value: 'city-three' } });
    expect(screen.getByTestId('city-city-three')).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', () => {
    render(<CityGrid cities={cities} onSelect={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('جستجوی شهر'), { target: { value: 'ایستگاه' } });
    expect(screen.getByText('شهری با این نام یافت نشد.')).toBeInTheDocument();
  });

  it('reports selection and marks the current city', () => {
    const onSelect = jest.fn();
    render(<CityGrid cities={cities} onSelect={onSelect} selectedCityId={1} />);

    expect(screen.getByTestId('city-city-one')).toHaveTextContent('✓ انتخاب‌شده');
    expect(screen.getByTestId('city-city-one')).toHaveTextContent('ویژه');

    fireEvent.click(screen.getByTestId('city-city-two'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 2, slug: 'city-two' }));
  });

  it('disables cards while syncing', () => {
    render(<CityGrid cities={cities} onSelect={jest.fn()} disabled />);
    expect(screen.getByTestId('city-city-one')).toBeDisabled();
  });
});
