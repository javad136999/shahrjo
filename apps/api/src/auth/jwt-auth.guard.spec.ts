import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AuthedRequest } from '../common/decorators';
import type { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeCtx(authHeader?: string): { ctx: ExecutionContext; req: AuthedRequest } {
  const req = { headers: authHeader ? { authorization: authHeader } : {} } as unknown as AuthedRequest;
  const ctx = {
    getHandler: () => jest.fn(),
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

function makeGuard() {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) }; // Reflector is sync
  const jwt = new JwtService({ secret: 'access-secret' });
  const prisma = { user: { findUnique: jest.fn() } };
  const guard = new JwtAuthGuard(
    reflector as unknown as Reflector,
    jwt,
    prisma as unknown as PrismaService,
  );
  return { guard, reflector, jwt, prisma };
}

async function expect401(promise: Promise<unknown>): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(HttpException);
  expect((caught as HttpException).getStatus()).toBe(401);
}

describe('JwtAuthGuard', () => {
  it('skips authentication on @Public routes', async () => {
    const { guard, reflector, prisma } = makeGuard();
    reflector.getAllAndOverride.mockReturnValue(true);
    const { ctx } = makeCtx();
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('attaches the user opportunistically on @Public routes when a valid token is sent', async () => {
    const { guard, reflector, jwt, prisma } = makeGuard();
    reflector.getAllAndOverride.mockReturnValue(true);
    const user = { id: 1, phone: '09123456789', status: 'ACTIVE' };
    prisma.user.findUnique.mockResolvedValue(user);
    const token = await jwt.signAsync({ sub: 1 });
    const { ctx, req } = makeCtx(`Bearer ${token}`);

    expect(await guard.canActivate(ctx)).toBe(true);
    expect(req.user).toBe(user); // optional enrichment, not a requirement
  });

  it('stays anonymous on @Public routes when the token is unusable', async () => {
    const { guard, reflector, prisma } = makeGuard();
    reflector.getAllAndOverride.mockReturnValue(true);
    const { ctx, req } = makeCtx('Bearer garbage-token');

    expect(await guard.canActivate(ctx)).toBe(true);
    expect(req.user).toBeUndefined();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects requests without an Authorization header', async () => {
    const { guard } = makeGuard();
    const { ctx } = makeCtx();
    await expect401(guard.canActivate(ctx));
  });

  it('rejects non-Bearer schemes', async () => {
    const { guard, jwt } = makeGuard();
    const token = await jwt.signAsync({ sub: 1 });
    const { ctx } = makeCtx(`Basic ${token}`);
    await expect401(guard.canActivate(ctx));
  });

  it('rejects tampered/invalid tokens', async () => {
    const { guard } = makeGuard();
    const { ctx } = makeCtx('Bearer not-a-real-token');
    await expect401(guard.canActivate(ctx));
  });

  it('rejects valid tokens whose user does not exist', async () => {
    const { guard, jwt, prisma } = makeGuard();
    prisma.user.findUnique.mockResolvedValue(null);
    const token = await jwt.signAsync({ sub: 999 });
    const { ctx } = makeCtx(`Bearer ${token}`);
    await expect401(guard.canActivate(ctx));
  });

  it('rejects banned accounts', async () => {
    const { guard, jwt, prisma } = makeGuard();
    prisma.user.findUnique.mockResolvedValue({ id: 1, status: 'BANNED' });
    const token = await jwt.signAsync({ sub: 1 });
    const { ctx } = makeCtx(`Bearer ${token}`);
    await expect401(guard.canActivate(ctx));
  });

  it('loads the user into the request for valid tokens', async () => {
    const { guard, jwt, prisma } = makeGuard();
    const user = { id: 1, phone: '09123456789', status: 'ACTIVE' };
    prisma.user.findUnique.mockResolvedValue(user);
    const token = await jwt.signAsync({ sub: 1 });
    const { ctx, req } = makeCtx(`Bearer ${token}`);

    expect(await guard.canActivate(ctx)).toBe(true);
    expect(req.user).toBe(user);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
