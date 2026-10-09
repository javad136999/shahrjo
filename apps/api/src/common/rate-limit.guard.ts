import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiterService } from '../redis/rate-limiter.service';
import { clientIpOf } from './client-ip.decorator';
import { RATE_LIMIT_KEY, type AuthedRequest, type RateLimitOptions } from './decorators';

/**
 * Per-route Redis rate limit declared with `@RateLimit({...})`.
 *
 * Runs after the global JwtAuthGuard (global guards execute before
 * method guards), so `req.user` is already attached on authenticated
 * routes. Counter subject follows the declared `subject`:
 *  - `ip`         → client IP (public routes, X-Real-IP aware)
 *  - `user`       → user id (authenticated routes; IP fallback if anonymous)
 *  - `user-or-ip` → user id when authenticated, else client IP
 * Limits already enforced in services (OTP, checkout, wall DB checks,
 * upload quota) are untouched — this is an early, cheap pre-filter.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!options) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const subjectKey =
      options.subject === 'ip' || !req.user
        ? `ip:${clientIpOf(req)}`
        : `user:${req.user.id}`;

    const result = await this.rateLimiter.hit(
      `${options.key}:${subjectKey}`,
      options.limit,
      options.windowSeconds,
    );
    if (result.allowed) return true;

    throw new HttpException(
      {
        code: 'RATE_LIMITED',
        message: 'تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید',
        details: { retryAfterSeconds: result.retryAfterSeconds },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
