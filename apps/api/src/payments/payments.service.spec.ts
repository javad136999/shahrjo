import type { User } from '@prisma/client';
import { BazaarService } from './bazaar.service';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';

const futureExpiry = Date.now() + 86_400_000;
const paymentRow = {
  id: 9,
  userId: 1,
  businessId: null,
  planId: 2,
  amount: 4_000_000n,
  status: 'CREATED',
  provider: 'BAZAAR',
  bazaarDeveloperPayload: 'shahrjo:expected-payload',
};

function makeService(purchase = {
  purchaseState: 0,
  orderId: 'order-9',
  developerPayload: 'shahrjo:expected-payload',
  validUntilTimestampMsec: futureExpiry,
  raw: { developerPayload: 'shahrjo:expected-payload' },
}) {
  const txMock = {
    payment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    subscriptionPlan: { findUniqueOrThrow: jest.fn().mockResolvedValue({ tier: 'GOLD' }) },
    subscription: { create: jest.fn().mockResolvedValue({}) },
    business: { findUnique: jest.fn(), update: jest.fn() },
  };
  const prismaMock = {
    payment: {
      findFirst: jest.fn().mockResolvedValue(paymentRow),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 10, amount: 4_000_000n }),
    },
    subscriptionPlan: {
      findFirst: jest.fn().mockResolvedValue({ id: 2, code: 'GOLD_1M', tier: 'GOLD', label: '۱ ماهه', price: 4_000_000n }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ code: 'GOLD_1M' }),
    },
    business: { findFirst: jest.fn() },
    notification: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (callback: (transaction: typeof txMock) => Promise<unknown>) => callback(txMock)),
  };
  const bazaarMock = {
    isConfigured: true,
    packageName: 'ir.shahrju.app',
    verifyPurchase: jest.fn().mockResolvedValue(purchase),
  };
  return {
    service: new PaymentsService(prismaMock as unknown as PrismaService, bazaarMock as unknown as BazaarService),
    prismaMock,
    bazaarMock,
    txMock,
  };
}

const user = { id: 1 } as User;
const verifyDto = { paymentId: 9, productId: 'GOLD_1M', purchaseToken: 'bazaar-token' };

describe('PaymentsService Cafe Bazaar subscriptions', () => {
  it('persists and returns a unique developerPayload for each checkout', async () => {
    const { service, prismaMock } = makeService();

    const checkout = await service.checkout(user, { planId: 2 });

    expect(checkout.packageName).toBe('ir.shahrju.app');
    expect(checkout.developerPayload).toMatch(/^shahrjo:[0-9a-f-]{36}$/i);
    expect(prismaMock.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ bazaarDeveloperPayload: checkout.developerPayload }),
    }));
  });

  it('does not activate a purchase whose Bazaar payload belongs to another checkout', async () => {
    const { service, prismaMock, bazaarMock } = makeService({
      purchaseState: 0,
      orderId: 'order-9',
      developerPayload: 'shahrjo:wrong-payload',
      validUntilTimestampMsec: futureExpiry,
      raw: { developerPayload: 'shahrjo:wrong-payload' },
    });

    await expect(service.verifyBazaar(user, verifyDto)).rejects.toThrow('شناسهٔ درخواست خرید بازار');
    expect(bazaarMock.verifyPurchase).toHaveBeenCalledWith('GOLD_1M', 'bazaar-token');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects expired subscriptions and persists the provider expiry for active ones', async () => {
    const expired = makeService({
      purchaseState: 0,
      orderId: 'order-9',
      developerPayload: 'shahrjo:expected-payload',
      validUntilTimestampMsec: Date.now() - 1_000,
      raw: { developerPayload: 'shahrjo:expected-payload' },
    });

    await expect(expired.service.verifyBazaar(user, verifyDto)).resolves.toBe('FAILED');
    expect(expired.prismaMock.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILED' }),
    }));
    expect(expired.prismaMock.$transaction).not.toHaveBeenCalled();

    const active = makeService();
    await expect(active.service.verifyBazaar(user, verifyDto)).resolves.toBe('SUCCESS');
    expect(active.txMock.subscription.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ expiresAt: new Date(futureExpiry) }),
    }));
  });
});
