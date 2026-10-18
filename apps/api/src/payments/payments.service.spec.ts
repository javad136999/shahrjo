import type { User } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { ZarinpalService } from './zarinpal.service';
import type { SepalService } from './sepal.service';
import { PaymentsService } from './payments.service';
import { CheckoutDto } from './payments.dto';

const user = { id: 21, phone: '09123456789', cityId: 7 } as User;

function makeService() {
  const prisma = {
    subscriptionPlan: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    business: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    payment: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    subscription: { create: jest.fn(), findMany: jest.fn() },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));

  const zarinpal = {
    requestPayment: jest.fn(),
    verifyPayment: jest.fn(),
    isConfigured: true,
  };
  // Sepal is the live gateway; default the mock to "not configured" so the
  // existing cases keep exercising the ZarinPal fallback path.
  const sepal = {
    requestPayment: jest.fn(),
    verifyPayment: jest.fn(),
    isConfigured: false,
  };
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    zarinpal as unknown as ZarinpalService,
    sepal as unknown as SepalService,
  );
  return { service, prisma, zarinpal, sepal };
}

const checkoutDto = (over: Partial<CheckoutDto> = {}): CheckoutDto => ({ planId: 3, ...over });

describe('PaymentsService.plans', () => {
  it('maps BigInt prices to JSON-safe numbers', async () => {
    const { service, prisma } = makeService();
    prisma.subscriptionPlan.findMany.mockResolvedValue([
      { id: 1, code: 'GOLD_1M', tier: 'GOLD', label: '۱ ماهه', badge: null, durationDays: 30, price: 4_000_000n, sortOrder: 1 },
    ]);

    const plans = await service.plans();
    expect(plans[0].price).toBe(4_000_000);
    expect(prisma.subscriptionPlan.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
  });
});

describe('PaymentsService.checkout', () => {
  it('creates CREATED then STARTED payment and returns the gateway URL', async () => {
    const { service, prisma, zarinpal } = makeService();
    prisma.subscriptionPlan.findFirst.mockResolvedValue({ id: 3, code: 'GOLD_1M', tier: 'GOLD', label: '۱ ماهه', price: 4_000_000n });
    prisma.payment.count.mockResolvedValue(0);
    prisma.payment.create.mockResolvedValue({ id: 55, amount: 4_000_000n });
    zarinpal.requestPayment.mockResolvedValue({ authority: 'A123', payUrl: 'https://sandbox.zarinpal.com/pg/StartPay/A123', code: 100, message: '' });
    prisma.payment.update.mockResolvedValue({ id: 55, amount: 4_000_000n, authority: 'A123' });

    const dto = checkoutDto();
    const result = await service.checkout(user, dto);

    expect(prisma.payment.create.mock.calls[0][0].data.status).toBe('CREATED');
    expect(prisma.payment.create.mock.calls[0][0].data.amount).toBe(4_000_000n);
    expect(prisma.payment.create.mock.calls[0][0].data.businessId).toBeNull();
    expect(prisma.payment.update.mock.calls[0][0].data).toMatchObject({ status: 'STARTED', authority: 'A123' });
    expect(result.payUrl).toContain('A123');
    expect(result.amount).toBe(4_000_000);
  });

  it('uses Sepal when SEPAL_API_KEY is set and freezes provider=SEPAL on the row', async () => {
    const { service, prisma, zarinpal, sepal } = makeService();
    sepal.isConfigured = true;
    prisma.subscriptionPlan.findFirst.mockResolvedValue({ id: 3, code: 'GOLD_1M', tier: 'GOLD', label: '۱ ماهه', price: 4_000_000n });
    prisma.payment.count.mockResolvedValue(0);
    prisma.payment.create.mockResolvedValue({ id: 71, amount: 4_000_000n });
    sepal.requestPayment.mockResolvedValue({ authority: '987654', payUrl: 'https://payment.sepal.ir/api/v1/payment/987654/', code: 100, message: '' });
    prisma.payment.update.mockResolvedValue({ id: 71, amount: 4_000_000n, authority: '987654' });

    const result = await service.checkout(user, checkoutDto());

    expect(prisma.payment.create.mock.calls[0][0].data.provider).toBe('SEPAL');
    // invoice number is our own payment id — the callback row can be found from it
    expect(sepal.requestPayment).toHaveBeenCalledWith(4_000_000n, '71', expect.stringContaining('اشتراک'));
    expect(zarinpal.requestPayment).not.toHaveBeenCalled();
    expect(prisma.payment.update.mock.calls[0][0].data).toMatchObject({ status: 'STARTED', authority: '987654' });
    expect(result.payUrl).toContain('987654');
  });

  it('falls back to ZarinPal when Sepal has no key and records provider=ZARINPAL', async () => {
    const { service, prisma, zarinpal, sepal } = makeService();
    prisma.subscriptionPlan.findFirst.mockResolvedValue({ id: 3, code: 'GOLD_1M', tier: 'GOLD', label: '۱ ماهه', price: 4_000_000n });
    prisma.payment.count.mockResolvedValue(0);
    prisma.payment.create.mockResolvedValue({ id: 72, amount: 4_000_000n });
    zarinpal.requestPayment.mockResolvedValue({ authority: 'A1', payUrl: 'x', code: 100, message: '' });
    prisma.payment.update.mockResolvedValue({ id: 72, amount: 4_000_000n, authority: 'A1' });

    await service.checkout(user, checkoutDto());

    expect(sepal.requestPayment).not.toHaveBeenCalled();
    expect(prisma.payment.create.mock.calls[0][0].data.provider).toBe('ZARINPAL');
    expect(zarinpal.requestPayment).toHaveBeenCalled();
  });

  it('binds the payment to an owned business when businessId is given', async () => {
    const { service, prisma, zarinpal } = makeService();
    prisma.subscriptionPlan.findFirst.mockResolvedValue({ id: 3, code: 'GOLD_1M', tier: 'GOLD', label: '۱ ماهه', price: 4_000_000n });
    prisma.business.findFirst.mockResolvedValue({ id: 9 });
    prisma.payment.count.mockResolvedValue(0);
    prisma.payment.create.mockResolvedValue({ id: 56, amount: 4_000_000n });
    zarinpal.requestPayment.mockResolvedValue({ authority: 'A777', payUrl: 'x', code: 100, message: '' });
    prisma.payment.update.mockResolvedValue({ id: 56, amount: 4_000_000n, authority: 'A777' });

    await service.checkout(user, checkoutDto({ businessId: 9 }));

    expect(prisma.business.findFirst.mock.calls[0][0].where).toMatchObject({ id: 9, ownerId: 21 });
    expect(prisma.payment.create.mock.calls[0][0].data.businessId).toBe(9);
  });

  it('404s on a foreign or missing business', async () => {
    const { service, prisma } = makeService();
    prisma.subscriptionPlan.findFirst.mockResolvedValue({ id: 3, code: 'GOLD_1M', tier: 'GOLD', label: '۱ ماهه', price: 4_000_000n });
    prisma.business.findFirst.mockResolvedValue(null);

    await expect(service.checkout(user, checkoutDto({ businessId: 123 }))).rejects.toThrow('کسب‌وکار یافت نشد');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('404s on an inactive/unknown plan', async () => {
    const { service, prisma } = makeService();
    prisma.subscriptionPlan.findFirst.mockResolvedValue(null);

    await expect(service.checkout(user, checkoutDto())).rejects.toThrow('پلن اشتراک یافت نشد');
  });

  it('rate-limits after 10 checkouts per hour', async () => {
    const { service, prisma } = makeService();
    prisma.subscriptionPlan.findFirst.mockResolvedValue({ id: 3, code: 'GOLD_1M', tier: 'GOLD', label: '۱ ماهه', price: 4_000_000n });
    prisma.payment.count.mockResolvedValue(10);

    await expect(service.checkout(user, checkoutDto())).rejects.toMatchObject({ status: 429 });
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('marks the payment FAILED and rethrows when the gateway is down', async () => {
    const { service, prisma, zarinpal } = makeService();
    prisma.subscriptionPlan.findFirst.mockResolvedValue({ id: 3, code: 'GOLD_1M', tier: 'GOLD', label: '۱ ماهه', price: 4_000_000n });
    prisma.payment.count.mockResolvedValue(0);
    prisma.payment.create.mockResolvedValue({ id: 57, amount: 4_000_000n });
    zarinpal.requestPayment.mockRejectedValue(new Error('درگاه پرداخت در دسترس نیست'));

    await expect(service.checkout(user, checkoutDto())).rejects.toThrow('درگاه');
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });
});

describe('PaymentsService.handleCallback', () => {
  const storedPayment = (over: Record<string, unknown> = {}) => ({
    id: 55,
    userId: 21,
    businessId: null,
    planId: 3,
    amount: 4_000_000n,
    status: 'STARTED',
    refId: null,
    ...over,
  });

  it('404s on an unknown authority', async () => {
    const { service, prisma } = makeService();
    prisma.payment.findUnique.mockResolvedValue(null);

    await expect(service.handleCallback('NOPE', 'OK')).rejects.toThrow('تراکنش یافت نشد');
  });

  it('cancels without calling verify when Status != OK', async () => {
    const { service, prisma, zarinpal } = makeService();
    prisma.payment.findUnique.mockResolvedValue(storedPayment());
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.handleCallback('A123', 'NOK');

    expect(result).toBe('CANCELED');
    expect(zarinpal.verifyPayment).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany.mock.calls[0][0].data.status).toBe('CANCELED');
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('returns ALREADY_PAID for an already-successful payment without verifying', async () => {
    const { service, prisma, zarinpal } = makeService();
    prisma.payment.findUnique.mockResolvedValue(storedPayment({ status: 'SUCCESS' }));

    expect(await service.handleCallback('A123', 'OK')).toBe('ALREADY_PAID');
    expect(zarinpal.verifyPayment).not.toHaveBeenCalled();
    expect(prisma.subscription.create).not.toHaveBeenCalled(); // a replayed callback must not activate twice
  });

  it('verifies with Sepal (invoice = our payment id) when the row provider is SEPAL', async () => {
    const { service, prisma, zarinpal, sepal } = makeService();
    prisma.payment.findUnique.mockResolvedValue(storedPayment({ provider: 'SEPAL' }));
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    sepal.verifyPayment.mockResolvedValue({ code: 100, refId: '1234567890', message: '' });
    prisma.subscriptionPlan.findUniqueOrThrow.mockResolvedValue({ tier: 'GOLD', durationDays: 30 });
    prisma.subscription.create.mockResolvedValue({ id: 1 });

    expect(await service.handleCallback('987654', 'OK')).toBe('SUCCESS');
    expect(sepal.verifyPayment).toHaveBeenCalledWith(4_000_000n, '987654', '55');
    expect(zarinpal.verifyPayment).not.toHaveBeenCalled();

    const claim = prisma.payment.updateMany.mock.calls[0][0];
    expect(claim.data).toMatchObject({ status: 'SUCCESS', resultCode: 100, refId: '1234567890' });
  });

  it('marks FAILED when Sepal verify is rejected', async () => {
    const { service, prisma, sepal } = makeService();
    prisma.payment.findUnique.mockResolvedValue(storedPayment({ provider: 'SEPAL' }));
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    sepal.verifyPayment.mockResolvedValue({ code: -1, refId: null, message: 'verify_failed' });

    expect(await service.handleCallback('987654', 'OK')).toBe('FAILED');
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('marks FAILED when verify returns an error code', async () => {
    const { service, prisma, zarinpal } = makeService();
    prisma.payment.findUnique.mockResolvedValue(storedPayment());
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    zarinpal.verifyPayment.mockResolvedValue({ code: 102, refId: null, message: 'invalid authority' });

    expect(await service.handleCallback('A123', 'OK')).toBe('FAILED');
    expect(zarinpal.verifyPayment).toHaveBeenCalledWith(4_000_000n, 'A123');
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', resultCode: 102 }) }),
    );
    expect(prisma.subscription.create).not.toHaveBeenCalled(); // failed verify must never activate anything
  });

  it('leaves the payment retryable (no SUCCESS claim) and creates no subscription when verify throws', async () => {
    const { service, prisma, zarinpal } = makeService();
    prisma.payment.findUnique.mockResolvedValue(storedPayment());
    zarinpal.verifyPayment.mockRejectedValue(new Error('gateway down'));

    await expect(service.handleCallback('A123', 'OK')).rejects.toThrow('gateway down');
    expect(prisma.payment.updateMany).not.toHaveBeenCalled(); // stays STARTED — re-hit of the callback can finish it
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('treats verify code 101 (already verified) as a success', async () => {
    const { service, prisma, zarinpal } = makeService();
    prisma.payment.findUnique.mockResolvedValue(storedPayment());
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    zarinpal.verifyPayment.mockResolvedValue({ code: 101, refId: 5, message: '' });
    prisma.subscriptionPlan.findUniqueOrThrow.mockResolvedValue({ tier: 'GOLD', durationDays: 30 });
    prisma.subscription.create.mockResolvedValue({ id: 3 });

    expect(await service.handleCallback('A123', 'OK')).toBe('SUCCESS');
  });

  it('activates a personal subscription immediately on verify code 100', async () => {
    const { service, prisma, zarinpal } = makeService();
    prisma.payment.findUnique.mockResolvedValue(storedPayment());
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    zarinpal.verifyPayment.mockResolvedValue({ code: 100, refId: 987654, message: '' });
    prisma.subscriptionPlan.findUniqueOrThrow.mockResolvedValue({ tier: 'GOLD', durationDays: 30 });
    prisma.subscription.create.mockResolvedValue({ id: 1 });

    expect(await service.handleCallback('A123', 'OK')).toBe('SUCCESS');
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 21,
        type: 'PAYMENT',
        title: 'پرداخت با موفقیت ثبت شد',
        body: 'اشتراک شما فعال شد.',
      },
    });

    const claim = prisma.payment.updateMany.mock.calls[0][0]; // claim is the only updateMany on this path
    expect(claim.where.status.in).toEqual(['CREATED', 'STARTED']);
    expect(claim.data).toMatchObject({ status: 'SUCCESS', resultCode: 100, refId: '987654' });

    const sub = prisma.subscription.create.mock.calls[0][0].data;
    expect(sub).toMatchObject({ userId: 21, businessId: null, tier: 'GOLD', status: 'ACTIVE' });
    expect(sub.startsAt).toBeInstanceOf(Date);
    expect(sub.expiresAt).toBeInstanceOf(Date);
    expect((sub.expiresAt as Date).getTime() - (sub.startsAt as Date).getTime()).toBe(30 * 86_400_000);
  });

  it('activates a business-bound subscription immediately and auto-approves the PENDING business', async () => {
    const { service, prisma, zarinpal } = makeService();
    prisma.payment.findUnique.mockResolvedValue(storedPayment({ businessId: 9 }));
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    zarinpal.verifyPayment.mockResolvedValue({ code: 100, refId: 1, message: '' });
    prisma.subscriptionPlan.findUniqueOrThrow.mockResolvedValue({ tier: 'SILVER', durationDays: 180 });
    prisma.subscription.create.mockResolvedValue({ id: 2 });
    prisma.business.findUnique.mockResolvedValue({ status: 'PENDING', subscriptionExpiresAt: null });
    prisma.business.update.mockResolvedValue({ id: 9 });

    expect(await service.handleCallback('A123', 'OK')).toBe('SUCCESS');

    // the subscription is live right away — no admin step for a paid plan
    const sub = prisma.subscription.create.mock.calls[0][0].data;
    expect(sub).toMatchObject({ businessId: 9, tier: 'SILVER', status: 'ACTIVE' });
    expect(sub.startsAt).toBeInstanceOf(Date);
    expect(sub.expiresAt).toBeInstanceOf(Date);
    expect((sub.expiresAt as Date).getTime() - (sub.startsAt as Date).getTime()).toBe(180 * 86_400_000);

    // and the registration it was paid for leaves the moderation queue
    expect(prisma.business.findUnique.mock.calls[0][0].where).toEqual({ id: 9 });
    const biz = prisma.business.update.mock.calls[0][0];
    expect(biz.where).toEqual({ id: 9 });
    expect(biz.data).toMatchObject({
      status: 'APPROVED',
      subscriptionTier: 'SILVER',
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: sub.expiresAt,
      showcasePriority: 50,
    });
  });

  it('keeps a later business expiry and never overrides an explicit admin REJECTED', async () => {
    const { service, prisma, zarinpal } = makeService();
    const later = new Date(Date.now() + 90 * 86_400_000);
    prisma.payment.findUnique.mockResolvedValue(storedPayment({ businessId: 9 }));
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    zarinpal.verifyPayment.mockResolvedValue({ code: 100, refId: 1, message: '' });
    prisma.subscriptionPlan.findUniqueOrThrow.mockResolvedValue({ tier: 'GOLD', durationDays: 30 });
    prisma.subscription.create.mockResolvedValue({ id: 4 });
    prisma.business.findUnique.mockResolvedValue({ status: 'REJECTED', subscriptionExpiresAt: later });
    prisma.business.update.mockResolvedValue({ id: 9 });

    expect(await service.handleCallback('A123', 'OK')).toBe('SUCCESS');

    const data = prisma.business.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('status'); // a rejected business stays rejected
    expect(data).toMatchObject({ subscriptionTier: 'GOLD', subscriptionStatus: 'ACTIVE', showcasePriority: 10 });
    expect(data.subscriptionExpiresAt).toBe(later); // never shorten an active period
  });

  it('reactivates a suspended (CLOSED) business and appends the purchased duration', async () => {
    const { service, prisma, zarinpal } = makeService();
    prisma.payment.findUnique.mockResolvedValue(storedPayment({ businessId: 9 }));
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    zarinpal.verifyPayment.mockResolvedValue({ code: 100, refId: 1, message: '' });
    prisma.subscriptionPlan.findUniqueOrThrow.mockResolvedValue({ tier: 'SILVER', durationDays: 180 });
    prisma.subscription.create.mockResolvedValue({ id: 5 });
    // suspended long ago (manually or by the expiry sweep)
    const staleExpiry = new Date(Date.now() - 30 * 86_400_000);
    prisma.business.findUnique.mockResolvedValue({ status: 'CLOSED', subscriptionExpiresAt: staleExpiry });
    prisma.business.update.mockResolvedValue({ id: 9 });

    expect(await service.handleCallback('A123', 'OK')).toBe('SUCCESS');

    const data = prisma.business.update.mock.calls[0][0].data;
    // the paid plan is what reactivates it: back on the street the same minute
    expect(data).toMatchObject({
      status: 'APPROVED',
      subscriptionTier: 'SILVER',
      subscriptionStatus: 'ACTIVE',
      showcasePriority: 50,
    });
    // a stale period never eats the purchased one: 180 days from now
    const expiry = data.subscriptionExpiresAt as Date;
    expect(expiry.getTime() - Date.now()).toBeGreaterThan(179 * 86_400_000);
    expect(expiry.getTime() - Date.now()).toBeLessThanOrEqual(180 * 86_400_000);
  });

  it('does not double-activate when a concurrent duplicate callback loses the claim', async () => {
    const { service, prisma, zarinpal } = makeService();
    prisma.payment.findUnique.mockResolvedValue(storedPayment());
    prisma.payment.updateMany.mockResolvedValue({ count: 0 }); // someone else already claimed
    zarinpal.verifyPayment.mockResolvedValue({ code: 101, refId: 1, message: '' });

    expect(await service.handleCallback('A123', 'OK')).toBe('ALREADY_PAID');
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });
});

describe('PaymentsService history', () => {
  it('maps payment amounts to numbers for JSON', async () => {
    const { service, prisma } = makeService();
    prisma.payment.findMany.mockResolvedValue([
      { id: 1, amount: 4_000_000n, status: 'SUCCESS', refId: '99', createdAt: new Date(), plan: { code: 'GOLD_1M', label: '۱ ماهه', tier: 'GOLD' } },
    ]);

    const mine = await service.mine(user);
    expect(mine[0].amount).toBe(4_000_000);
    expect(mine[0].plan.tier).toBe('GOLD');
  });

  it('returns subscriptions with plan and business labels', async () => {
    const { service, prisma } = makeService();
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: 4,
        tier: 'GOLD',
        status: 'ACTIVE',
        startsAt: new Date(),
        expiresAt: new Date(),
        createdAt: new Date(),
        plan: { code: 'GOLD_1M', label: '۱ ماهه', tier: 'GOLD' },
        business: null,
      },
    ]);

    const subs = await service.mySubscriptions(user);
    expect(subs[0].status).toBe('ACTIVE');
    expect(subs[0].business).toBeNull();
    expect(prisma.subscription.findMany.mock.calls[0][0].where).toEqual({ userId: 21 });
  });
});
