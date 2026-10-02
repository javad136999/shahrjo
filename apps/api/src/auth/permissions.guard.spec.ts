import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthedRequest } from '../common/decorators';
import type { RbacService } from '../rbac/rbac.service';
import { PermissionsGuard } from './permissions.guard';

function makeCtx(user?: { id: number }): { ctx: ExecutionContext; req: AuthedRequest } {
  const req = { user } as unknown as AuthedRequest;
  const ctx = {
    getHandler: () => jest.fn(),
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

function makeGuard(required: string[] | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) };
  const rbac = { getPermissions: jest.fn().mockResolvedValue(['ads.view', 'users.view']) };
  const guard = new PermissionsGuard(reflector as unknown as Reflector, rbac as unknown as RbacService);
  return { guard, rbac };
}

async function expectHttp(promise: Promise<unknown>, status: number, code: string): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(HttpException);
  expect((caught as HttpException).getStatus()).toBe(status);
  expect((caught as HttpException).getResponse()).toMatchObject({ code });
}

describe('PermissionsGuard', () => {
  it('allows routes without @RequirePermissions', async () => {
    const { guard, rbac } = makeGuard(undefined);
    const { ctx } = makeCtx({ id: 1 });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(rbac.getPermissions).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests (guard order violation)', async () => {
    const { guard } = makeGuard(['ads.view']);
    const { ctx } = makeCtx(undefined);
    await expectHttp(guard.canActivate(ctx), 401, 'UNAUTHORIZED');
  });

  it('rejects users lacking the required permission', async () => {
    const { guard } = makeGuard(['payments.view']);
    const { ctx } = makeCtx({ id: 1 });
    await expectHttp(guard.canActivate(ctx), 403, 'FORBIDDEN');
  });

  it('allows users holding every required permission', async () => {
    const { guard, rbac } = makeGuard(['ads.view', 'users.view']);
    const { ctx } = makeCtx({ id: 1 });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(rbac.getPermissions).toHaveBeenCalledWith(1);
  });

  it('requires ALL listed permissions (AND semantics)', async () => {
    const { guard } = makeGuard(['ads.view', 'payments.view']); // user lacks payments.view
    const { ctx } = makeCtx({ id: 1 });
    await expectHttp(guard.canActivate(ctx), 403, 'FORBIDDEN');
  });
});
