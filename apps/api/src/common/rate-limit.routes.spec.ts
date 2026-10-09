import 'reflect-metadata';
import { AdsController } from '../ads/ads.controller';
import { AuthController } from '../auth/auth.controller';
import { UploadsController } from '../uploads/uploads.controller';
import { WallController } from '../wall/wall.controller';
import { NO_STORE_KEY, RATE_LIMIT_KEY, type RateLimitOptions } from './decorators';

/**
 * Wiring checks: the P0 rate-limit/no-store policy must sit on the real
 * routes (decorators are easy to lose during refactors), not only in the
 * guard unit tests.
 */
function limitOf(target: object, method: string): RateLimitOptions | undefined {
  const fn = (target as unknown as Record<string, unknown>)[method];
  return Reflect.getMetadata(RATE_LIMIT_KEY, fn as object);
}

describe('P0 route policy wiring', () => {
  it('rate-limits public ad detail (300/min per user-or-ip) and marks it no-store', () => {
    const options = limitOf(AdsController.prototype, 'detail');
    expect(options).toMatchObject({
      key: 'ad:detail',
      limit: 300,
      windowSeconds: 60,
      subject: 'user-or-ip',
    });
    expect(Reflect.getMetadata(NO_STORE_KEY, AdsController.prototype.detail)).toBe(true);
  });

  it('rate-limits both upload endpoints (30 attempts/hour per user)', () => {
    expect(limitOf(UploadsController.prototype, 'upload')).toMatchObject({
      key: 'uploads',
      limit: 30,
      windowSeconds: 3600,
      subject: 'user',
    });
    expect(limitOf(UploadsController.prototype, 'uploadVoice')).toMatchObject({
      key: 'uploads',
      limit: 30,
      windowSeconds: 3600,
      subject: 'user',
    });
  });

  it('rate-limits wall posting (10/min per user) but leaves GET /wall polling open', () => {
    expect(limitOf(WallController.prototype, 'create')).toMatchObject({
      key: 'wall:post',
      limit: 10,
      windowSeconds: 60,
      subject: 'user',
    });
    expect(limitOf(WallController.prototype, 'list')).toBeUndefined();
  });

  it('marks the whole auth controller no-store (token/sessions payloads)', () => {
    expect(Reflect.getMetadata(NO_STORE_KEY, AuthController)).toBe(true);
  });

  it('keeps OTP/checkout-related routes free of the new limiter (existing limits untouched)', () => {
    expect(limitOf(AuthController.prototype, 'sendOtp')).toBeUndefined();
    expect(limitOf(AuthController.prototype, 'verifyOtp')).toBeUndefined();
  });
});
