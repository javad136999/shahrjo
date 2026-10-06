/**
 * @jest-environment jsdom
 */
import { ApiError, api, clearTokens, getTokens, setTokens } from '@/lib/api';

const ENDPOINT = '/api/v1/users/me';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('api client', () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('unwraps the { data } response envelope', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ data: { id: 7, phone: '0912' } }));

    const me = await api.get<{ id: number; phone: string }>('/users/me');

    expect(me).toEqual({ id: 7, phone: '0912' });
    expect(global.fetch).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sends Authorization when tokens exist and JSON body for POST', async () => {
    setTokens({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ data: { sent: true } }));

    await api.post('/auth/send-otp', { phone: '09123456789' });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/v1/auth/send-otp');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-token');
    expect(init.body).toBe(JSON.stringify({ phone: '09123456789' }));
  });

  it('refreshes on 401 once and replays the request', async () => {
    setTokens({ accessToken: 'old', refreshToken: 'valid-refresh' });
    const unauthorized = jsonResponse({ message: 'unauthorized' }, 401);
    const success = jsonResponse({ data: { id: 1 } });
    const refreshed = jsonResponse({ data: { accessToken: 'new-access', refreshToken: 'new-refresh' } });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(unauthorized) // original call
      .mockResolvedValueOnce(refreshed) // refresh call
      .mockResolvedValueOnce(success); // replay

    const me = await api.get<{ id: number }>('/users/me');

    expect(me).toEqual({ id: 1 });
    expect(getTokens()).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('clears tokens and throws when refresh fails', async () => {
    setTokens({ accessToken: 'expired', refreshToken: 'dead-refresh' });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse({ message: 'x' }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: 'refresh failed' }, 401));

    await expect(api.get('/users/me')).rejects.toThrow(ApiError);
    expect(getTokens()).toBeNull();
  });

  it('maps server error messages to ApiError with status', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ message: 'شهر انتخاب‌شده یافت نشد' }, 404),
    );

    const err = await api.patch('/users/me', { cityId: 999 }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).message).toBe('شهر انتخاب‌شده یافت نشد');
  });

  it('flattens array validation messages', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ message: ['کد نامعتبر است', 'شماره نادرست'] }, 400),
    );

    const err = await api.post('/auth/verify-otp', {}).catch((e: unknown) => e);

    expect((err as ApiError).message).toBe('کد نامعتبر است، شماره نادرست');
  });

  it('surfaces the nested envelope error message ({ data, error })', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse(
        { data: null, error: { code: 'INVALID_OTP', message: 'کد ورود نامعتبر یا منقضی شده است' } },
        400,
      ),
    );

    const err = await api.post('/auth/verify-otp', {}).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
    expect((err as ApiError).message).toBe('کد ورود نامعتبر یا منقضی شده است');
  });

  it('falls back to a generic status message when the body is not JSON', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not json')),
    } as Response);

    const err = await api.get('/showcase?city=x').catch((e: unknown) => e);

    expect((err as ApiError).message).toBe('خطای 502');
  });

  it('persists tokens in localStorage only (never in cookies)', () => {
    setTokens({ accessToken: 'a', refreshToken: 'r' });
    expect(window.localStorage.getItem('shahrjo.tokens')).toContain('"accessToken":"a"');
    expect(document.cookie).toBe('');
    clearTokens();
    expect(getTokens()).toBeNull();
  });
});
