import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BazaarService } from './bazaar.service';

describe('BazaarService subscriptions', () => {
  const config = {
    get: jest.fn((key: string) => (key === 'BAZAAR_ACCESS_TOKEN' ? 'test-access-token' : 'ir.shahrju.app')),
  } as unknown as ConfigService;
  let service: BazaarService;

  beforeEach(() => {
    jest.restoreAllMocks();
    service = new BazaarService(config);
  });

  it('validates against the subscription endpoint and returns the market expiry', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ purchaseState: 0, orderId: 'order-test', validUntilTimestampMsec: '1792867200000' }),
    } as Response);

    const result = await service.verifyPurchase('M1_GOLD', 'test-purchase-token');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/applications/ir.shahrju.app/subscriptions/M1_GOLD/purchases/test-purchase-token/');
    expect(String(fetchMock.mock.calls[0][0])).toContain('access_token=test-access-token');
    expect(result.purchaseState).toBe(0);
    expect(result.orderId).toBe('order-test');
    expect(result.validUntilTimestampMsec).toBe(1792867200000);
  });

  it('leaves the expiry null when Bazaar omits or invalidates the optional field', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ purchaseState: 0 }),
    } as Response);

    const result = await service.verifyPurchase('M1_SILVER', 'test-purchase-token');
    expect(result.validUntilTimestampMsec).toBeNull();
  });

  it('reports Bazaar HTML responses as a gateway error without exposing the body', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '<html>not found</html>',
    } as Response);

    try {
      await service.verifyPurchase('M1_GOLD', 'test-purchase-token');
      fail('Expected non-JSON Bazaar response to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(502);
      expect((error as HttpException).message).toContain('پاسخ نامعتبر از بازار');
    }
  });
});
