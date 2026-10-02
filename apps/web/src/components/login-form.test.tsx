import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = jest.fn();
const refresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams('next=/city/dayer'),
}));

const sendOtp = jest.fn();
const verifyOtp = jest.fn();

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  sendOtp: (...args: unknown[]) => sendOtp(...args),
  verifyOtp: (...args: unknown[]) => verifyOtp(...args),
}));

import { LoginForm } from '@/components/login-form';
import { ApiError } from '@/lib/api';

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an invalid Iranian mobile without calling the API', () => {
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: /ارسال کد تأیید/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('شماره موبایل معتبر');
    expect(sendOtp).not.toHaveBeenCalled();
  });

  it('moves to the code step on a valid phone and shows the cooldown', async () => {
    sendOtp.mockResolvedValue({ sent: true, cooldownSeconds: 60 });
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09123456789' } });
    fireEvent.click(screen.getByRole('button', { name: /ارسال کد تأیید/ }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'کد تأیید' })).toBeInTheDocument());
    expect(sendOtp).toHaveBeenCalledWith('09123456789');
    expect(screen.getByRole('button', { name: /ارسال مجدد \(60\)/ })).toBeDisabled();
    expect(screen.getByText(/09123456789/)).toBeInTheDocument();
  });

  it('verifies the OTP and redirects to the ?next target', async () => {
    sendOtp.mockResolvedValue({ sent: true, cooldownSeconds: 60 });
    verifyOtp.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', user: { id: 1 } });
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09123456789' } });
    fireEvent.click(screen.getByRole('button', { name: /ارسال کد تأیید/ }));
    await waitFor(() => expect(screen.getByLabelText('کد تأیید')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('کد تأیید'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'ورود' }));

    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith('09123456789', '123456'),
    );
    expect(push).toHaveBeenCalledWith('/city/dayer');
  });

  it('surfaces API errors from a rejected OTP', async () => {
    sendOtp.mockResolvedValue({ sent: true, cooldownSeconds: 0 });
    verifyOtp.mockRejectedValue(new ApiError(400, 'کد نامعتبر است'));
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09123456789' } });
    fireEvent.click(screen.getByRole('button', { name: /ارسال کد تأیید/ }));
    await waitFor(() => expect(screen.getByLabelText('کد تأیید')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('کد تأیید'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'ورود' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('کد نامعتبر است'));
    expect(push).not.toHaveBeenCalled();
  });
});
