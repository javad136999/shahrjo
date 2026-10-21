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
  it('opens a place description and travel specifications below its card when tapped', () => {
    render(<CityTourismView city={city} />);

    const details = screen.getByTestId('tourism-details-shiraz-hafez');
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByText(/آرامگاه حافظ در باغی شاعرانه/)).not.toBeVisible();

    fireEvent.click(details.querySelector('summary')!);

    expect(details).toHaveAttribute('open');
    expect(within(details).getByText(/آرامگاه حافظ در باغی شاعرانه/)).toBeInTheDocument();
    expect(within(details).getByText('دسته‌بندی')).toBeInTheDocument();
    expect(within(details).getByText('مختصات')).toBeInTheDocument();
    expect(within(details).getByRole('link', { name: /مشاهدهٔ مکان روی نقشه/ })).toHaveAttribute('target', '_blank');
    expect(within(details).getByRole('link', { name: /منبع اطلاعات/ })).toHaveAttribute('href', expect.stringContaining('eghamat24'));

    fireEvent.click(details.querySelector('summary')!);
    expect(details).not.toHaveAttribute('open');
  });
});
