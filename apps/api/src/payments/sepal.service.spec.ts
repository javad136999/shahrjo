import { ConfigService } from '@nestjs/config';
import { SepalService } from './sepal.service';

function makeService(over: Record<string, string> = {}) {
  const config = {
    get: (key: string) => over[key],
  } as unknown as ConfigService;
  return new SepalService(config);
}

const baseEnv = {
  SEPAL_API_KEY: 'test-api-key',
  SEPAL_CALLBACK_URL: 'https://example.test/api/v1/payments/callback',
};

describe('SepalService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is unconfigured without an api key', () => {
    expect(makeService({ ...baseEnv, SEPAL_API_KEY: '' }).isConfigured).toBe(false);
    expect(makeService(baseEnv).isConfigured).toBe(true);
  });

  it('builds the payment page URL from the returned paymentNumber', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: true, message: '', paymentNumber: 987654 }), { status: 200 }),
    );

    const result = await makeService(baseEnv).requestPayment(4_000_000n, '51', 'desc');

    expect(result.authority).toBe('987654');
    expect(result.payUrl).toBe('https://payment.sepal.ir/api/v1/payment/987654/');
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      apiKey: baseEnv.SEPAL_API_KEY,
      amount: 4_000_000,
      invoiceNumber: '51',
      callbackMethod: 'get',
    });
    expect(body.callbackUrl).toBe(baseEnv.SEPAL_CALLBACK_URL);
    // The API key must only travel server-to-server, never to the client.
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('https://payment.sepal.ir/api/v1/payment/request/');
  });

  it('rejects a request when Sepal reports status=false', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: false, message: 'invalid_amount' }), { status: 200 }),
    );

    await expect(makeService(baseEnv).requestPayment(1n, '1', 'd')).rejects.toThrow('درگاه پرداخت در دسترس نیست');
  });

  it('rejects a request when paymentNumber is missing', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: true, message: '' }), { status: 200 }),
    );

    await expect(makeService(baseEnv).requestPayment(1n, '1', 'd')).rejects.toThrow('درگاه پرداخت در دسترس نیست');
  });

  it('parses a successful verify and keeps the bank reference number', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ status: true, message: '', referenceNumber: '1122334455', amount: 4_000_000, cardNumber: '6037-****' }),
        { status: 200 },
      ),
    );

    const verify = await makeService(baseEnv).verifyPayment(4_000_000n, '987654', '51');
    expect(verify).toEqual({ code: 100, refId: '1122334455', message: '' });
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(body).toMatchObject({ apiKey: baseEnv.SEPAL_API_KEY, paymentNumber: '987654', invoiceNumber: '51' });
  });

  it('maps alreadyVerified to code 101 (idempotent replay)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: true, alreadyVerified: true, referenceNumber: '99', amount: 4_000_000 }), { status: 200 }),
    );

    const verify = await makeService(baseEnv).verifyPayment(4_000_000n, '987654', '51');
    expect(verify.code).toBe(101);
  });

  it('returns a failed code when Sepal verify is rejected', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: false, message: 'payment_not_found' }), { status: 200 }),
    );

    const verify = await makeService(baseEnv).verifyPayment(1n, '0', '1');
    expect(verify).toEqual({ code: -1, refId: null, message: 'payment_not_found' });
  });

  it('fails when the echoed amount does not match our stored amount', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: true, referenceNumber: '5', amount: 1_000 }), { status: 200 }),
    );

    const verify = await makeService(baseEnv).verifyPayment(4_000_000n, '987654', '51');
    expect(verify.code).toBe(-52);
    expect(verify.message).toContain('یکسان نیست');
  });

  it('throws 502 on a non-JSON body', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('<html>oops</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }),
    );

    await expect(makeService(baseEnv).verifyPayment(1n, '1', '1')).rejects.toThrow('پاسخ نامعتبر از درگاه پرداخت');
  });

  it('throws 502 when the gateway is unreachable', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(makeService(baseEnv).requestPayment(1n, '1', 'd')).rejects.toThrow('ارتباط با درگاه پرداخت برقرار نشد');
  });

  it('refuses to call the gateway without configuration', async () => {
    const svc = makeService({ ...baseEnv, SEPAL_API_KEY: '' });
    await expect(svc.requestPayment(1n, '1', 'd')).rejects.toThrow('SEPAL_API_KEY');
    await expect(svc.verifyPayment(1n, '1', '1')).rejects.toThrow('SEPAL_API_KEY');
  });
});
