import { ConfigService } from '@nestjs/config';
import { ConsoleSmsProvider } from './adapters/console.provider';
import { KavenegarSmsProvider } from './adapters/kavenegar.provider';
import { SmsIrProvider } from './adapters/smsir.provider';
import { createSmsProvider } from './sms.provider';

const cfg = (env: Record<string, string | undefined>) => new ConfigService(env);

describe('createSmsProvider factory', () => {
  it('defaults to the console adapter', () => {
    expect(createSmsProvider(cfg({}))).toBeInstanceOf(ConsoleSmsProvider);
  });

  it('creates the kavenegar adapter when configured', () => {
    const provider = createSmsProvider(cfg({ SMS_PROVIDER: 'kavenegar', SMS_API_KEY: 'KEY' }));
    expect(provider).toBeInstanceOf(KavenegarSmsProvider);
    expect(provider.name).toBe('kavenegar');
  });

  it('creates the smsir adapter when configured', () => {
    const provider = createSmsProvider(cfg({ SMS_PROVIDER: 'smsir', SMS_API_KEY: 'KEY' }));
    expect(provider).toBeInstanceOf(SmsIrProvider);
  });

  it('throws without an API key for paid providers', () => {
    expect(() => createSmsProvider(cfg({ SMS_PROVIDER: 'kavenegar' }))).toThrow('SMS_API_KEY');
    expect(() => createSmsProvider(cfg({ SMS_PROVIDER: 'smsir' }))).toThrow('SMS_API_KEY');
  });

  it('throws on unknown providers (fail fast instead of silent fallback)', () => {
    expect(() => createSmsProvider(cfg({ SMS_PROVIDER: 'unknown-vendor' }))).toThrow('Unknown SMS_PROVIDER');
  });
});

describe('ConsoleSmsProvider', () => {
  it('always succeeds (dev)', async () => {
    const result = await new ConsoleSmsProvider().sendOtp('09123456789', '12345');
    expect(result.success).toBe(true);
  });
});

describe('KavenegarSmsProvider', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses verify/lookup with template when SMS_OTP_TEMPLATE is set', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ return: 200, requestId: 99 }) });
    const provider = new KavenegarSmsProvider('APIKEY', 'shahrjo-otp');

    const result = await provider.sendOtp('09123456789', '12345');

    expect(result).toEqual({ success: true, messageId: '99' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('https://kavenegar.com/v1/APIKEY/verify/lookup.json');
    expect(url).toContain('receptor=9123456789');
    expect(url).toContain('token=12345');
    expect(url).toContain('template=shahrjo-otp');
  });

  it('falls back to plain send without a template', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ return: 200 }) });
    const provider = new KavenegarSmsProvider('APIKEY', undefined, '1000500');

    const result = await provider.sendOtp('09123456789', '54321');

    expect(result.success).toBe(true);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/sms/send.json');
    expect(url).toContain('message=');
    expect(url).toContain('sender=1000500');
  });

  it('reports provider-level errors', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ return: 500 }) });
    const provider = new KavenegarSmsProvider('APIKEY', 'tpl');
    const result = await provider.sendOtp('09123456789', '11111');
    expect(result.success).toBe(false);
    expect(result.error).toContain('return=500');
  });

  it('never throws on network failures', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const provider = new KavenegarSmsProvider('APIKEY', 'tpl');
    const result = await provider.sendOtp('09123456789', '11111');
    expect(result.success).toBe(false);
    expect(result.error).toContain('network down');
  });
});

describe('SmsIrProvider', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses the verify endpoint with a numeric template id', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ code: 200, id: 7 }) });
    const provider = new SmsIrProvider('APIKEY', '123456');

    const result = await provider.sendOtp('09123456789', '11111');

    expect(result).toEqual({ success: true, messageId: '7' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('https://api.sms.ir/v1/send/verify');
    expect(init.headers['x-api-key']).toBe('APIKEY');
    expect(JSON.parse(init.body as string)).toEqual({
      mobile: '9123456789',
      templateId: 123456,
      parameters: [{ name: 'CODE', value: '11111' }],
    });
  });

  it('falls back to bulk send with a line number', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ code: 200 }) });
    const provider = new SmsIrProvider('APIKEY', undefined, '300000000000');

    await provider.sendOtp('09123456789', '22222');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.sms.ir/v1/send/bulk');
    const body = JSON.parse(init.body as string);
    expect(body.lineNumber).toBe(300000000000);
    expect(body.mobiles).toEqual(['9123456789']);
    expect(body.messageText).toContain('22222');
  });

  it('fails fast without template or line', async () => {
    const provider = new SmsIrProvider('APIKEY');
    const result = await provider.sendOtp('09123456789', '12345');
    expect(result.success).toBe(false);
    expect(result.error).toContain('SMS_OTP_TEMPLATE');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports API error codes', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ code: 401, message: 'unauthorized' }) });
    const provider = new SmsIrProvider('APIKEY', '123');
    const result = await provider.sendOtp('09123456789', '12345');
    expect(result.success).toBe(false);
    expect(result.error).toContain('code=401');
  });
});
