import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiterService } from '../redis/rate-limiter.service';
import type { RateLimitOptions } from './decorators';
import { RateLimitGuard } from './rate-limit.guard';

function handler() {}
class Ctrl {}

function makeContext(req: Record<string, unknown>) {
  return {
    getHandler: () => handler,
    getClass: () => Ctrl,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  let hit: jest.Mock;
  let guard: RateLimitGuard;
  let reflectorGet: jest.Mock;

  beforeEach(() => {
    hit = jest.fn().mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 0 });
    const limiter = { hit } as unknown as RateLimiterService;
    reflectorGet = jest.fn();
    const reflector = { getAllAndOverride: reflectorGet } as unknown as Reflector;
    guard = new RateLimitGuard(reflector, limiter);
  });

  it('passes when the route has no @RateLimit metadata and never hits redis', async () => {
    reflectorGet.mockReturnValue(null);
    await expect(guard.canActivate(makeContext({ headers: {} }))).resolves.toBe(true);
    expect(hit).not.toHaveBeenCalled();
  });

  it('allows the request while under the limit', async () => {
    reflectorGet.mockReturnValue({ key: 'x', limit: 5, windowSeconds: 60, subject: 'ip' } satisfies RateLimitOptions);
    await expect(guard.canActivate(makeContext({ headers: { 'x-real-ip': '1.2.3.4' } }))).resolves.toBe(true);
    expect(hit).toHaveBeenCalledWith('x:ip:1.2.3.4', 5, 60);
  });

  it('rejects with 429 RATE_LIMITED and retryAfterSeconds when blocked', async () => {
    hit.mockResolvedValue({ allowed: false, remaining: 0, retryAfterSeconds: 42 });
    reflectorGet.mockReturnValue({ key: 'x', limit: 5, windowSeconds: 60, subject: 'ip' } satisfies RateLimitOptions);
    const ctx = makeContext({ headers: { 'x-real-ip': '1.2.3.4' } });
    let caught: HttpException | undefined;
    try {
      await guard.canActivate(ctx);
    } catch (e) {
      caught = e as HttpException;
    }
    expect(caught).toBeInstanceOf(HttpException);
    expect(caught!.getStatus()).toBe(429);
    expect(caught!.getResponse()).toMatchObject({
      code: 'RATE_LIMITED',
      details: { retryAfterSeconds: 42 },
    });
  });

  it('keys subject:user by the authenticated user id', async () => {
    reflectorGet.mockReturnValue({ key: 'wall:post', limit: 10, windowSeconds: 60, subject: 'user' } satisfies RateLimitOptions);
    await guard.canActivate(makeContext({ headers: { 'x-real-ip': '9.9.9.9' }, user: { id: 42 } }));
    expect(hit).toHaveBeenCalledWith('wall:post:user:42', 10, 60);
  });

  it('keys subject:user by the IP when the request is anonymous (fallback)', async () => {
    reflectorGet.mockReturnValue({ key: 'uploads', limit: 30, windowSeconds: 3600, subject: 'user' } satisfies RateLimitOptions);
    await guard.canActivate(makeContext({ headers: { 'x-real-ip': '9.9.9.9' } }));
    expect(hit).toHaveBeenCalledWith('uploads:ip:9.9.9.9', 30, 3600);
  });

  it('keys subject:user-or-ip per user when authenticated and per IP otherwise', async () => {
    const options = { key: 'ad:detail', limit: 300, windowSeconds: 60, subject: 'user-or-ip' } satisfies RateLimitOptions;
    reflectorGet.mockReturnValue(options);
    await guard.canActivate(makeContext({ headers: { 'x-real-ip': '5.5.5.5' }, user: { id: 7 } }));
    expect(hit).toHaveBeenCalledWith('ad:detail:user:7', 300, 60);

    await guard.canActivate(makeContext({ headers: { 'x-real-ip': '5.5.5.5' } }));
    expect(hit).toHaveBeenLastCalledWith('ad:detail:ip:5.5.5.5', 300, 60);
  });

  it('falls back to the connection IP when no x-real-ip header is present', async () => {
    reflectorGet.mockReturnValue({ key: 'x', limit: 1, windowSeconds: 60, subject: 'ip' } satisfies RateLimitOptions);
    await guard.canActivate(makeContext({ headers: {}, ip: '10.0.0.1' }));
    expect(hit).toHaveBeenCalledWith('x:ip:10.0.0.1', 1, 60);
  });

  it('propagates limiter failures as a HttpException-shaped rejection (no silent fail-open)', async () => {
    hit.mockRejectedValue(new Error('redis down'));
    reflectorGet.mockReturnValue({ key: 'x', limit: 1, windowSeconds: 60, subject: 'ip' } satisfies RateLimitOptions);
    await expect(guard.canActivate(makeContext({ headers: { 'x-real-ip': '1.1.1.1' } }))).rejects.toThrow('redis down');
  });
});
