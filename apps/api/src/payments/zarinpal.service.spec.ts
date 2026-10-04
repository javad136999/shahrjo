import { ConfigService } from '@nestjs/config';
import { ZarinpalService } from './zarinpal.service';

function makeService(over: Record<string, string> = {}) {
  const config = {
    get: (key: string) => over[key],
  } as unknown as ConfigService;
  return new ZarinpalService(config);
}

const baseEnv = {
  ZARINPAL_MERCHANT_ID: '00000000-0000-0000-0000-000000000000',
  ZARINPAL_SANDBOX: 'true',
  ZARINPAL_CALLBACK_URL: 'https://example.test/api/v1/payments/callback',
};

describe('ZarinpalService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is unconfigured without a merchant id', () => {
    expect(makeService({ ...baseEnv, ZARINPAL_MERCHANT_ID: '' }).isConfigured).toBe(false);
    expect(makeService({ ...baseEnv, ZARINPAL_MERCHANT_ID: '' }).isConfigured).toBe(false);
  });

  it('builds the sandbox pay URL from the returned authority', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { code: 100, authority: 'A123', message: 'OK' } }), { status: 200 }),
    );

    const result = await makeService(baseEnv).requestPayment(4_000_000n, 'desc');

    expect(result.authority).toBe('A123');
    expect(result.payUrl).toBe('https://sandbox.zarinpal.com/pg/StartPay/A123');
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(body).toMatchObject({ merchant_id: baseEnv.ZARINPAL_MERCHANT_ID, amount: 4_000_000, currency: 'IRR' });
    expect(body.callback_url).toBe(baseEnv.ZARINPAL_CALLBACK_URL);
  });

  it('uses the production host when sandbox is off', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { code: 100, authority: 'A9', message: '' } }), { status: 200 }),
    );

    const result = await makeService({ ...baseEnv, ZARINPAL_SANDBOX: 'false' }).requestPayment(1n, 'd');
    expect(result.payUrl).toContain('payment.zarinpal.com');
  });

  it('rejects a request when ZarinPal returns no authority', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { code: -50, message: 'invalid merchant' } }), { status: 200 }),
    );

    await expect(makeService(baseEnv).requestPayment(1n, 'd')).rejects.toThrow('درگاه پرداخت در دسترس نیست');
  });

  it('surfaces a non-2xx error body that carries { code, message } (verify -51 etc.)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'not paid', code: -51, validations: [] }), { status: 401 }),
    );

    const verify = await makeService(baseEnv).verifyPayment(4_000_000n, 'A1');
    expect(verify.code).toBe(-51);
    expect(verify.refId).toBeNull();
    expect(verify.message).toBe('not paid');
  });

  it('unwraps the real sandbox error envelope { data: null, errors: { code } }', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ data: null, errors: { message: 'Session is not valid', code: -51, validations: [] } }),
        { status: 401 },
      ),
    );

    const verify = await makeService(baseEnv).verifyPayment(4_000_000n, 'A1');
    expect(verify.code).toBe(-51);
    expect(verify.message).toBe('Session is not valid');
    expect(verify.refId).toBeNull();
  });

  it('parses a successful verify envelope', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { code: 100, ref_id: 987654, message: 'OK' } }), { status: 200 }),
    );

    const verify = await makeService(baseEnv).verifyPayment(4_000_000n, 'A1');
    expect(verify).toEqual({ code: 100, refId: 987654, message: 'OK' });
  });

  it('throws 502 on a body with neither data nor code', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('<html>oops</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }),
    );

    await expect(makeService(baseEnv).verifyPayment(1n, 'A1')).rejects.toThrow('پاسخ نامعتبر از درگاه پرداخت');
  });

  it('throws 502 when the gateway is unreachable', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(makeService(baseEnv).verifyPayment(1n, 'A1')).rejects.toThrow('ارتباط با درگاه پرداخت برقرار نشد');
  });

  it('refuses to call the gateway without configuration', async () => {
    const svc = makeService({ ...baseEnv, ZARINPAL_MERCHANT_ID: '' });
    await expect(svc.requestPayment(1n, 'd')).rejects.toThrow('ZARINPAL_MERCHANT_ID');
    await expect(svc.verifyPayment(1n, 'A')).rejects.toThrow('ZARINPAL_MERCHANT_ID');
  });
});
