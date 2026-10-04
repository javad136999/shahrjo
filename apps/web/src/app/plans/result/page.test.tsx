import { render, screen } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
}));

import PaymentResultPage from '@/app/plans/result/page';

const mockUseSearchParams = useSearchParams as unknown as jest.Mock;

describe('PaymentResultPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the success copy for SUCCESS', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('status=SUCCESS&authority=A1'));
    render(<PaymentResultPage />);

    const card = screen.getByTestId('payment-result');
    expect(card).toHaveAttribute('data-status', 'SUCCESS');
    expect(card).toHaveTextContent('پرداخت موفق بود');
    expect(screen.getByRole('link', { name: 'بازگشت به پلن‌ها' })).toHaveAttribute('href', '/plans');
  });

  it('renders the canceled copy for CANCELED', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('status=CANCELED'));
    render(<PaymentResultPage />);

    expect(screen.getByTestId('payment-result')).toHaveTextContent('پرداخت لغو شد');
  });

  it('falls back to failure copy on an unknown status', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams(''));
    render(<PaymentResultPage />);

    const card = screen.getByTestId('payment-result');
    expect(card).toHaveAttribute('data-status', 'FAILED');
    expect(card).toHaveTextContent('پرداخت ناموفق بود');
  });
});
