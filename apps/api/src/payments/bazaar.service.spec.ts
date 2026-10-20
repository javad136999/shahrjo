import { ConfigService } from '@nestjs/config';
import { BazaarService } from './bazaar.service';

function makeConfig(packageName = 'ir.shahrju.app'): ConfigService {
  const values: Record<string, string> = {
    BAZAAR_ACCESS_TOKEN: 'test-access-token',
    BAZAAR_PACKAGE_NAME: packageName,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('BazaarService subscription verification', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the official subscriptions endpoint and returns payload and expiry', async () => {
    const validUntilTimestampMsec = Date.now() + 86_400_000;
    const responseBody = {
      purchaseState: 0,
      orderId: 'order-1',
      developerPayload: 'shahrjo:payment-1',
      validUntilTimestampMsec,
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => responseBody,
    } as Response);
    const service = new BazaarService(makeConfig());

    const result = await service.verifyPurchase('GOLD_1M', 'token/one');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://pardakht.cafebazaar.ir/devapi/v2/api/applications/ir.shahrju.app/subscriptions/GOLD_1M/purchases/token%2Fone?access_token=test-access-token',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toMatchObject({
      purchaseState: 0,
      orderId: 'order-1',
      developerPayload: 'shahrjo:payment-1',
      validUntilTimestampMsec,
    });
  });

  it('refuses a package name different from the app registered in Bazaar', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const service = new BazaarService(makeConfig('ir.shahrjo'));

    expect(service.isConfigured).toBe(false);
    await expect(service.verifyPurchase('GOLD_1M', 'token')).rejects.toThrow('BAZAAR_PACKAGE_NAME');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a subscription response without a valid-until timestamp', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ purchaseState: 0, developerPayload: 'shahrjo:payment-1' }),
    } as Response);
    const service = new BazaarService(makeConfig());

    await expect(service.verifyPurchase('GOLD_1M', 'token')).rejects.toThrow('زمان اعتبار اشتراک');
  });
});
