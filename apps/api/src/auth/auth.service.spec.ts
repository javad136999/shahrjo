import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hmacOtp, hmacToken } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import type { RateLimiterService } from '../redis/rate-limiter.service';
import type { SmsProvider } from '../sms/sms.types';
import { AuthService } from './auth.service';

const PEPPER = 'otp-pepper';
const REFRESH_SECRET = 'refresh-secret';
const ACCESS_SECRET = 'access-secret';
const PHONE = '09123456789';

function makePrisma() {
  return {
    otpCode: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    userSession: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  };
}

function makeService() {
  const prisma = makePrisma();
  const config = new ConfigService({
    OTP_HASH_SECRET: PEPPER,
    JWT_REFRESH_SECRET: REFRESH_SECRET,
    OTP_LENGTH: '5',
    OTP_TTL_SECONDS: '120',
    OTP_MAX_ATTEMPTS: '3',
    OTP_IP_LIMIT_PER_HOUR: '20',
    OTP_REQUEST_LIMIT_PER_HOUR: '5',
    OTP_RESEND_COOLDOWN_SECONDS: '60',
    JWT_REFRESH_TTL: '30d',
  });
  const jwt = new JwtService({ secret: ACCESS_SECRET, signOptions: { expiresIn: '15m' } });
  const rateLimiter = {
    hit: jest.fn().mockResolvedValue({ allowed: true, remaining: 9, retryAfterSeconds: 0 }),
  };
  const sms = {
    name: 'mock',
    sendOtp: jest.fn().mockResolvedValue({ success: true, messageId: 'm1' }),
  };

  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt,
    config,
    rateLimiter as unknown as RateLimiterService,
    sms as unknown as SmsProvider,
  );

  return { service, prisma, rateLimiter, sms, jwt };
}

async function expectHttp(promise: Promise<unknown>, status: number, code: string): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(HttpException);
  const e = caught as HttpException;
  expect(e.getStatus()).toBe(status);
  expect(e.getResponse()).toMatchObject({ code });
}

function activeOtpRow(code: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    phone: PHONE,
    codeHash: hmacOtp(PEPPER, PHONE, code),
    purpose: 'LOGIN',
    attempts: 0,
    maxAttempts: 3,
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    lastIp: 'ip1',
    createdAt: new Date(),
    ...overrides,
  };
}

const activeUser = {
  id: 1,
  phone: PHONE,
  fullName: null,
  avatarUrl: null,
  cityId: null,
  status: 'ACTIVE',
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService.sendOtp', () => {
  it('rejects invalid phone numbers before any side effect', async () => {
    const { service, prisma } = makeService();
    await expectHttp(service.sendOtp({ phone: '12345', ip: 'ip1' }), 400, 'INVALID_PHONE');
    expect(prisma.otpCode.create).not.toHaveBeenCalled();
  });

  it('blocks when the IP rate limit is exceeded', async () => {
    const { service, prisma, rateLimiter } = makeService();
    rateLimiter.hit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 120 });
    await expectHttp(service.sendOtp({ phone: PHONE, ip: 'ip1' }), 429, 'RATE_LIMITED');
    expect(prisma.otpCode.create).not.toHaveBeenCalled();
  });

  it('blocks when the phone rate limit is exceeded', async () => {
    const { service, prisma, rateLimiter } = makeService();
    rateLimiter.hit
      .mockResolvedValueOnce({ allowed: true, remaining: 1, retryAfterSeconds: 0 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 300 });
    await expectHttp(service.sendOtp({ phone: PHONE, ip: 'ip1' }), 429, 'RATE_LIMITED');
    expect(prisma.otpCode.create).not.toHaveBeenCalled();
  });

  it('enforces the resend cooldown', async () => {
    const { service, prisma } = makeService();
    prisma.otpCode.findFirst.mockResolvedValue({ id: 7 });
    await expectHttp(service.sendOtp({ phone: PHONE, ip: 'ip1' }), 429, 'RATE_LIMITED');
    expect(prisma.otpCode.create).not.toHaveBeenCalled();
  });

  it('stores a peppered hash, never the raw code, and sends the code via SMS', async () => {
    const { service, prisma, sms } = makeService();
    prisma.otpCode.findFirst.mockResolvedValue(null); // cooldown ok
    prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
    prisma.otpCode.create.mockResolvedValue({});

    const result = await service.sendOtp({ phone: PHONE, ip: 'ip1' });

    expect(result).toEqual({ sent: true, cooldownSeconds: 60 });
    expect(sms.sendOtp).toHaveBeenCalledTimes(1);
    const [sentTo, sentCode] = sms.sendOtp.mock.calls[0];
    expect(sentTo).toBe(PHONE);
    expect(sentCode).toMatch(/^\d{5}$/);

    const created = prisma.otpCode.create.mock.calls[0][0].data;
    expect(created.codeHash).toBe(hmacOtp(PEPPER, PHONE, sentCode));
    expect(created.codeHash).not.toContain(sentCode);
    expect(created.purpose).toBe('LOGIN');
    expect(created.maxAttempts).toBe(3);
    expect(created.lastIp).toBe('ip1');
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now() + 110_000);
    expect(created.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 120_000);

    // previous active codes are invalidated
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { phone: PHONE, purpose: 'LOGIN', consumedAt: null } }),
    );
  });

  it('invalidates the fresh OTP and returns 502 when the SMS provider fails', async () => {
    const { service, prisma, sms } = makeService();
    prisma.otpCode.findFirst.mockResolvedValue(null);
    prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.otpCode.create.mockResolvedValue({});
    sms.sendOtp.mockResolvedValueOnce({ success: false, error: 'provider down' });

    await expectHttp(service.sendOtp({ phone: PHONE, ip: 'ip1' }), 502, 'SMS_SEND_FAILED');
    expect(prisma.otpCode.updateMany).toHaveBeenCalledTimes(2); // invalidate-old + cleanup
  });
});

describe('AuthService.verifyOtp', () => {
  it('rejects invalid phone numbers', async () => {
    const { service } = makeService();
    await expectHttp(service.verifyOtp({ phone: 'bad', code: '12345', ip: 'ip1' }), 400, 'INVALID_PHONE');
  });

  it('rejects when no active OTP exists', async () => {
    const { service, prisma } = makeService();
    prisma.otpCode.findFirst.mockResolvedValue(null);
    await expectHttp(service.verifyOtp({ phone: PHONE, code: '12345', ip: 'ip1' }), 400, 'INVALID_OTP');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects expired OTPs', async () => {
    const { service, prisma } = makeService();
    prisma.otpCode.findFirst.mockResolvedValue(
      activeOtpRow('12345', { expiresAt: new Date(Date.now() - 1_000) }),
    );
    await expectHttp(service.verifyOtp({ phone: PHONE, code: '12345', ip: 'ip1' }), 400, 'INVALID_OTP');
  });

  it('increments attempts on a wrong code and does not consume the OTP', async () => {
    const { service, prisma } = makeService();
    prisma.otpCode.findFirst.mockResolvedValue(activeOtpRow('12345'));
    prisma.otpCode.update.mockResolvedValue({ attempts: 1, maxAttempts: 3 });

    await expectHttp(service.verifyOtp({ phone: PHONE, code: '99999', ip: 'ip1' }), 400, 'INVALID_OTP');
    expect(prisma.otpCode.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { attempts: { increment: 1 } },
    });
    expect(prisma.otpCode.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('consumes the OTP when the attempt limit is reached', async () => {
    const { service, prisma } = makeService();
    prisma.otpCode.findFirst.mockResolvedValue(activeOtpRow('12345'));
    prisma.otpCode.update.mockResolvedValue({ attempts: 3, maxAttempts: 3 });

    await expectHttp(service.verifyOtp({ phone: PHONE, code: '99999', ip: 'ip1' }), 400, 'INVALID_OTP');
    expect(prisma.otpCode.update).toHaveBeenLastCalledWith({
      where: { id: 10 },
      data: { consumedAt: expect.any(Date) },
    });
  });

  it('logs in a returning user and issues tokens', async () => {
    const { service, prisma, jwt } = makeService();
    prisma.otpCode.findFirst.mockResolvedValue(activeOtpRow('12345'));
    prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue({ ...activeUser, cityId: 42 });
    prisma.user.update.mockResolvedValue({ ...activeUser, cityId: 42 });
    prisma.userSession.create.mockResolvedValue({});

    const result = await service.verifyOtp({ phone: PHONE, code: '12345', ip: 'ip1', userAgent: 'jest' });

    expect(result.user).toEqual({ id: 1, phone: PHONE, fullName: null, avatarUrl: null, cityId: 42 });
    const payload = (await jwt.verifyAsync(result.accessToken)) as { sub: number; phone: string };
    expect(payload.sub).toBe(1);
    expect(payload.phone).toBe(PHONE);
    expect(result.refreshToken).toMatch(/^[\w-]{64}$/);

    const session = prisma.userSession.create.mock.calls[0][0].data;
    expect(session.refreshTokenHash).toBe(hmacToken(REFRESH_SECRET, result.refreshToken));
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    expect(session.ipAddress).toBe('ip1');
    expect(session.userAgent).toBe('jest');
    // one-time use
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 10, consumedAt: null } }),
    );
  });

  it('creates a new user on first login (cityId null => city selection)', async () => {
    const { service, prisma } = makeService();
    prisma.otpCode.findFirst.mockResolvedValue(activeOtpRow('12345'));
    prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ ...activeUser, id: 9, cityId: null });
    prisma.userSession.create.mockResolvedValue({});

    const result = await service.verifyOtp({ phone: PHONE, code: '12345', ip: 'ip1' });

    expect(prisma.user.create).toHaveBeenCalledWith({ data: { phone: PHONE, lastLoginAt: expect.any(Date) } });
    expect(result.user.cityId).toBeNull();
  });

  it('rejects when the OTP was already consumed (one-time use race)', async () => {
    const { service, prisma } = makeService();
    prisma.otpCode.findFirst.mockResolvedValue(activeOtpRow('12345'));
    prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
    await expectHttp(service.verifyOtp({ phone: PHONE, code: '12345', ip: 'ip1' }), 400, 'INVALID_OTP');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('blocks banned accounts', async () => {
    const { service, prisma } = makeService();
    prisma.otpCode.findFirst.mockResolvedValue(activeOtpRow('12345'));
    prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue({ ...activeUser, status: 'BANNED' });
    await expectHttp(service.verifyOtp({ phone: PHONE, code: '12345', ip: 'ip1' }), 403, 'ACCOUNT_BANNED');
  });

  it('rate limits repeated verify attempts', async () => {
    const { service, rateLimiter } = makeService();
    rateLimiter.hit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 60 });
    await expectHttp(service.verifyOtp({ phone: PHONE, code: '12345', ip: 'ip1' }), 429, 'RATE_LIMITED');
  });
});

describe('AuthService.refresh', () => {
  it('rejects unknown refresh tokens', async () => {
    const { service, prisma } = makeService();
    prisma.userSession.findUnique.mockResolvedValue(null);
    await expectHttp(
      service.refresh({ refreshToken: 'x'.repeat(64), ip: 'ip1' }),
      401,
      'INVALID_REFRESH_TOKEN',
    );
  });

  it('rejects expired sessions without touching the family', async () => {
    const { service, prisma } = makeService();
    prisma.userSession.findUnique.mockResolvedValue({
      id: 5,
      userId: 1,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
    });
    await expectHttp(
      service.refresh({ refreshToken: 'x'.repeat(64), ip: 'ip1' }),
      401,
      'INVALID_REFRESH_TOKEN',
    );
    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('detects token reuse and revokes the whole family', async () => {
    const { service, prisma } = makeService();
    prisma.userSession.findUnique.mockResolvedValue({
      id: 5,
      userId: 1,
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    await expectHttp(
      service.refresh({ refreshToken: 'x'.repeat(64), ip: 'ip1' }),
      401,
      'INVALID_REFRESH_TOKEN',
    );
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 1, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rotates the session: revokes the old token and issues a new pair', async () => {
    const { service, prisma, jwt } = makeService();
    prisma.userSession.findUnique.mockResolvedValue({
      id: 5,
      userId: 1,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    prisma.user.findUnique.mockResolvedValue(activeUser);
    prisma.userSession.update.mockResolvedValue({});
    prisma.userSession.create.mockResolvedValue({});

    const oldToken = 'a'.repeat(64);
    const result = await service.refresh({ refreshToken: oldToken, ip: 'ip1' });

    expect(prisma.userSession.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result.refreshToken).not.toBe(oldToken);
    expect(prisma.userSession.create).toHaveBeenCalledTimes(1);
    const payload = (await jwt.verifyAsync(result.accessToken)) as { sub: number };
    expect(payload.sub).toBe(1);
  });

  it('rejects refresh for non-active users', async () => {
    const { service, prisma } = makeService();
    prisma.userSession.findUnique.mockResolvedValue({
      id: 5,
      userId: 1,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    prisma.user.findUnique.mockResolvedValue({ ...activeUser, status: 'BANNED' });
    await expectHttp(
      service.refresh({ refreshToken: 'x'.repeat(64), ip: 'ip1' }),
      401,
      'INVALID_REFRESH_TOKEN',
    );
    expect(prisma.userSession.update).not.toHaveBeenCalled();
  });
});

describe('AuthService.logout', () => {
  it('revokes the session', async () => {
    const { service, prisma } = makeService();
    prisma.userSession.findUnique.mockResolvedValue({
      id: 5,
      userId: 1,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    prisma.userSession.update.mockResolvedValue({});

    const result = await service.logout({ refreshToken: 'y'.repeat(64) });
    expect(result).toEqual({ loggedOut: true });
    expect(prisma.userSession.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('is idempotent for unknown tokens', async () => {
    const { service, prisma } = makeService();
    prisma.userSession.findUnique.mockResolvedValue(null);
    const result = await service.logout({ refreshToken: 'y'.repeat(64) });
    expect(result).toEqual({ loggedOut: true });
    expect(prisma.userSession.update).not.toHaveBeenCalled();
  });
});

describe('AuthService sessions (session security)', () => {
  it('lists only active sessions of the user', async () => {
    const { service, prisma } = makeService();
    const rows = [
      { id: 3, createdAt: new Date(), lastUsedAt: null, ipAddress: '1.2.3.4', userAgent: 'jest' },
    ];
    prisma.userSession.findMany.mockResolvedValue(rows);

    const result = await service.listSessions({ id: 1 } as never);

    expect(result.sessions).toEqual(rows);
    expect(prisma.userSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1, revokedAt: null, expiresAt: { gt: expect.any(Date) } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('logout-all revokes every active session of the user', async () => {
    const { service, prisma } = makeService();
    prisma.userSession.updateMany.mockResolvedValue({ count: 3 });

    const result = await service.logoutAll({ id: 1 } as never);

    expect(result).toEqual({ revoked: 3 });
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 1, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
