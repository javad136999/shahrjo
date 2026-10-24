import { BazaarService } from './bazaar.service';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PaymentsService Bazaar product IDs', () => {
  const prisma = {
    subscriptionPlan: { findFirst: jest.fn() },
    payment: { count: jest.fn(), create: jest.fn() },
    business: { findFirst: jest.fn() },
  };
  const bazaar = { isConfigured: true, packageName: 'ir.shahrju.app' };
  let service: PaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentsService(prisma as unknown as PrismaService, bazaar as unknown as BazaarService);
    prisma.payment.count.mockResolvedValue(0);
  });

  it.each([
    ['GOLD_1M', 'M1_GOLD'],
    ['GOLD_6M', 'M6_GOLD'],
    ['GOLD_12M', 'M12_GOLD'],
    ['SILVER_1M', 'M1_SILVER'],
    ['SILVER_6M', 'M6_SILVER'],
    ['SILVER_12M', 'M12_SILVER'],
  ])('returns %s as Bazaar product %s', async (planCode, bazaarProductId) => {
    const price = 1_000_000n;
    prisma.subscriptionPlan.findFirst.mockResolvedValue({
      id: 12,
      code: planCode,
      tier: planCode.startsWith('GOLD') ? 'GOLD' : 'SILVER',
      label: '۱ ماهه',
      price,
    });
    prisma.payment.create.mockResolvedValue({ id: 77, amount: price });

    const result = await service.checkout({ id: 5 } as never, { planId: 12 } as never);

    expect(result.productId).toBe(bazaarProductId);
    expect(result.packageName).toBe('ir.shahrju.app');
  });
});
