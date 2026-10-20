import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = jest.fn();
const refresh = jest.fn();
const mockSearchParams = new URLSearchParams('next=/city/dayer');
const mockGetLocalCity = jest.fn((): { id: number; slug: string; name: string } | null => null);

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => mockSearchParams,
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
  getLocalCity: () => mockGetLocalCity(),
}));

import { LoginForm } from '@/components/login-form';
import { ApiError } from '@/lib/api';

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.set('next', '/city/dayer');
    mockGetLocalCity.mockReturnValue(null);
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
    // a full code auto-submits — the ورود button is no longer needed for it
    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith('09123456789', '123456'),
    );
    expect(push).toHaveBeenCalledWith('/city/dayer');
  });

  it('prefers the remembered city after login when there is no next target', async () => {
    mockSearchParams.delete('next');
    mockGetLocalCity.mockReturnValue({ id: 7, slug: 'tehran', name: 'تهران' });
    sendOtp.mockResolvedValue({ sent: true, cooldownSeconds: 60 });
    verifyOtp.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', user: { id: 1 } });
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09123456789' } });
    fireEvent.click(screen.getByRole('button', { name: /ارسال کد تأیید/ }));
    await waitFor(() => expect(screen.getByLabelText('کد تأیید')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('کد تأیید'), { target: { value: '123456' } });

    await waitFor(() => expect(push).toHaveBeenCalledWith('/city/tehran'));
  });

  it('auto-fills the code and completes the login by itself (console SMS)', async () => {
    // the console provider never sends a real SMS, so the API echoes the code
    // for the form to fill — and then nobody should type it
    sendOtp.mockResolvedValue({ sent: true, cooldownSeconds: 60, codeLength: 5, autoFillCode: '54321' });
    verifyOtp.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', user: { id: 1 } });
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09123456789' } });
    fireEvent.click(screen.getByRole('button', { name: /ارسال کد تأیید/ }));

    // the field fills itself AND the login runs without another tap
    await waitFor(() => expect(screen.getByLabelText('کد تأیید')).toHaveValue('54321'));
    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith('09123456789', '54321'));
    expect(push).toHaveBeenCalledWith('/city/dayer');
  });

  it('logs in the moment an autofilled/pasted code fills the field', async () => {
    sendOtp.mockResolvedValue({ sent: true, cooldownSeconds: 60, codeLength: 5 });
    verifyOtp.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', user: { id: 1 } });
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09123456789' } });
    fireEvent.click(screen.getByRole('button', { name: /ارسال کد تأیید/ }));
    await waitFor(() => expect(screen.getByLabelText('کد تأیید')).toBeInTheDocument());

    // SMS autofill/paste drops the full code in — no ورود tap needed
    fireEvent.change(screen.getByLabelText('کد تأیید'), { target: { value: '12345' } });

    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith('09123456789', '12345'));
    expect(push).toHaveBeenCalledWith('/city/dayer');
  });

  it('surfaces API errors from a rejected OTP', async () => {
    sendOtp.mockResolvedValue({ sent: true, cooldownSeconds: 0 });
    verifyOtp.mockRejectedValue(new ApiError(400, 'کد نامعتبر است'));
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText('شماره موبایل'), { target: { value: '09123456789' } });
    fireEvent.click(screen.getByRole('button', { name: /ارسال کد تأیید/ }));
    await waitFor(() => expect(screen.getByLabelText('کد تأیید')).toBeInTheDocument());

    // a short (still valid-shaped) code does NOT auto-submit: the button path
    // stays reachable for anyone who wants to fix and resubmit
    fireEvent.change(screen.getByLabelText('کد تأیید'), { target: { value: '0000' } });
    fireEvent.click(screen.getByRole('button', { name: 'ورود' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('کد نامعتبر است'));
    expect(push).not.toHaveBeenCalled();
  });
});
