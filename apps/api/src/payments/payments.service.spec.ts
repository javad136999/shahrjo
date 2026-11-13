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
    ['GOLD_1M', 'GOLD_1M'],
    ['GOLD_6M', 'GOLD_6M'],
    ['GOLD_12M', 'GOLD_12M'],
    ['SILVER_1M', 'SILVER_1M'],
    ['SILVER_6M', 'SILVER_6M'],
    ['SILVER_12M', 'SILVER_12M'],
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

describe('PaymentsService business activation after a verified payment', () => {
  function makeTx() {
    return {
      subscription: { create: jest.fn().mockResolvedValue({ id: 1 }) },
      business: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    };
  }

  const service = new PaymentsService({} as unknown as PrismaService, {} as unknown as BazaarService);
  const payment = { userId: 1, businessId: 5, planId: 2 };

  it('publishes a newly registered (PENDING) business atomically after verified payment', async () => {
    const tx = makeTx();
    tx.business.findUnique.mockResolvedValue({ status: 'PENDING', subscriptionExpiresAt: null });

    await (service as any).activateVerifiedPayment(tx, payment, { tier: 'GOLD', durationDays: 30 }, null);

    const data = tx.business.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      status: 'APPROVED',
      subscriptionTier: 'GOLD',
      subscriptionStatus: 'ACTIVE',
      showcasePriority: 10,
    });
  });

  it('restores an expired (CLOSED) business immediately on a renewal payment', async () => {
    const tx = makeTx();
    tx.business.findUnique.mockResolvedValue({ status: 'CLOSED', subscriptionExpiresAt: null });

    await (service as any).activateVerifiedPayment(tx, payment, { tier: 'SILVER', durationDays: 30 }, null);

    expect(tx.business.update.mock.calls[0][0].data).toMatchObject({
      status: 'APPROVED',
      subscriptionStatus: 'ACTIVE',
      showcasePriority: 50,
    });
  });

  it('does not override an explicit rejection when payment is verified', async () => {
    const tx = makeTx();
    tx.business.findUnique.mockResolvedValue({ status: 'REJECTED', subscriptionExpiresAt: null });

    await (service as any).activateVerifiedPayment(tx, payment, { tier: 'SILVER', durationDays: 30 }, null);

    expect(tx.business.update.mock.calls[0][0].data).not.toHaveProperty('status');
    expect(tx.business.update.mock.calls[0][0].data.subscriptionStatus).toBe('ACTIVE');
  });
});
