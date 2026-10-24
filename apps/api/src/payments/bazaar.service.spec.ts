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
      json: async () => ({ purchaseState: 0, orderId: 'order-test', validUntilTimestampMsec: '1792867200000' }),
    } as Response);

    const result = await service.verifyPurchase('M1_GOLD', 'test-purchase-token');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/subscriptions/M1_GOLD/purchases/test-purchase-token/');
    expect(result.purchaseState).toBe(0);
    expect(result.orderId).toBe('order-test');
    expect(result.validUntilTimestampMsec).toBe(1792867200000);
  });

  it('leaves the expiry null when Bazaar omits or invalidates the optional field', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ purchaseState: 0 }),
    } as Response);

    const result = await service.verifyPurchase('M1_SILVER', 'test-purchase-token');
    expect(result.validUntilTimestampMsec).toBeNull();
  });
});
