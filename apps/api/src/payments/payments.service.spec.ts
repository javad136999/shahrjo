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

describe('PaymentsService manual receipt flow', () => {
  const prisma = {
    subscriptionPlan: { findFirst: jest.fn() },
    payment: { count: jest.fn(), create: jest.fn() },
    business: { findFirst: jest.fn() },
    media: { findFirst: jest.fn(), updateMany: jest.fn() },
    subscription: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new PaymentsService(prisma as unknown as PrismaService, {} as unknown as BazaarService);
  const receiptUrl = '/api/v1/files/media/2026/11/receipt.webp';

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.subscriptionPlan.findFirst.mockResolvedValue({ id: 12, tier: 'GOLD', price: 500_000n });
    prisma.business.findFirst.mockResolvedValue({ id: 77 });
    prisma.media.findFirst.mockResolvedValue({ id: 88 });
    prisma.subscription.create.mockResolvedValue({ id: 101 });
    prisma.payment.create.mockResolvedValue({ id: 202 });
    prisma.media.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
  });

  it('requires an owned, unclaimed PAYMENT receipt instead of trusting the URL', async () => {
    prisma.media.findFirst.mockResolvedValue(null);

    await expect(service.manual({ id: 5 } as never, { planId: 12, businessId: 77, invoiceUrl: receiptUrl })).rejects.toMatchObject({ status: 400 });
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('creates the pending request and claims the receipt by payment id in one transaction', async () => {
    const result = await service.manual({ id: 5 } as never, { planId: 12, businessId: 77, invoiceUrl: receiptUrl });

    expect(result).toEqual({ paymentId: 202, subscriptionId: 101, status: 'PENDING_REVIEW' });
    expect(prisma.media.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ownerUserId: 5, entityType: 'PAYMENT', entityId: null, url: receiptUrl }),
    }));
    expect(prisma.media.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 88, ownerUserId: 5, entityType: 'PAYMENT', entityId: null }),
      data: { entityId: '202' },
    });
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
