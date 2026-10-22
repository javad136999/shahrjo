import { fireEvent, render, screen, within } from '@testing-library/react';
import { CityTourismView } from '@/components/city-tourism';
import type { City } from '@/lib/types';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));

const city: City = {
  id: 1,
  name: 'شهر نمونه',
  slug: 'shiraz',
  isFeatured: true,
  latitude: 29.59,
  longitude: 52.58,
  province: { id: 1, name: 'فارس', slug: 'fars' },
};

describe('CityTourismView place details', () => {
  it('opens a place description and linked map below its card when tapped', () => {
    render(<CityTourismView city={city} />);

    const details = screen.getByTestId('tourism-details-shiraz-hafez');
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByText(/آرامگاه شاعر در باغی آرام/)).not.toBeVisible();

    fireEvent.click(details.querySelector('summary')!);

    expect(details).toHaveAttribute('open');
    expect(within(details).getByText(/آرامگاه شاعر در باغی آرام/)).toBeInTheDocument();
    expect(within(details).queryByText('دسته‌بندی')).not.toBeInTheDocument();
    expect(within(details).queryByText('زمان پیشنهادی')).not.toBeInTheDocument();
    expect(within(details).queryByText('محدوده')).not.toBeInTheDocument();
    expect(within(details).queryByText('مختصات')).not.toBeInTheDocument();
    const card = details.closest('li')!;
    expect(within(card).getByRole('img', { name: 'عکس حافظیه' })).toHaveAttribute('loading', 'lazy');
    expect(within(details).getByRole('link', { name: /عکس: Diego Delso/ })).toHaveAttribute('href', expect.stringContaining('commons.wikimedia.org/wiki/File:Mausoleo_de_Hafez'));
    expect(within(details).getByRole('link', { name: /مشاهدهٔ مکان روی نقشه/ })).toHaveAttribute('target', '_blank');
    expect(within(details).getByRole('link', { name: /منبع اطلاعات/ })).toHaveAttribute('href', expect.stringContaining('eghamat24'));

    fireEvent.click(details.querySelector('summary')!);
    expect(details).not.toHaveAttribute('open');
  });

  it('shows the full-view licensed photo for Jam’s Mount Padri without an emoji overlay', () => {
    const jam: City = { ...city, name: 'شهر نمونه', slug: 'jam' };
    render(<CityTourismView city={jam} />);

    const card = screen.getByTestId('tourism-jam-pardis');
    expect(within(card).getByRole('img', { name: 'عکس کوه پدری (پردیس)' })).toHaveAttribute('src', '/tourism/jam-pardis.webp');
    expect(card).not.toHaveTextContent('⛰️');
    fireEvent.click(screen.getByTestId('tourism-details-jam-pardis').querySelector('summary')!);
    expect(within(card).getByRole('link', { name: /عکس: Hamedvahid · CC BY-SA 4.0/ })).toHaveAttribute('href', expect.stringContaining('commons.wikimedia.org/wiki/File:'));
  });
});
