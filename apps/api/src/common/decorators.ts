import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Request } from 'express';

export const PUBLIC_KEY = 'isPublic';
export const PERMISSIONS_KEY = 'requiredPermissions';
export const NO_STORE_KEY = 'noStore';
export const RATE_LIMIT_KEY = 'rateLimit';

/** Marks a route as accessible without an access token (OTP endpoints). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Requires the given permission codes (checked against role_permissions by PermissionsGuard). */
export const RequirePermissions = (...codes: string[]) => SetMetadata(PERMISSIONS_KEY, codes);

/**
 * Forces `Cache-Control: private, no-store` on the response. Applied to
 * sensitive/public routes whose payload must never sit in a browser or proxy
 * cache (auth token responses, ad detail with owner-only fields, …).
 * Authenticated routes get the header automatically in TransformInterceptor.
 */
export const NoStore = () => SetMetadata(NO_STORE_KEY, true);

/** Per-route Redis rate limit (RateLimitGuard). */
export interface RateLimitOptions {
  /** Key namespace, e.g. `ad:detail`. */
  key: string;
  /** Max hits per window. */
  limit: number;
  windowSeconds: number;
  /**
   * Counter subject: `ip` = per client IP; `user` = per user id (falls back
   * to IP when anonymous); `user-or-ip` = per user when authenticated, else IP.
   */
  subject: 'ip' | 'user' | 'user-or-ip';
}

/** Applies RateLimitGuard with the given options to a route. */
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

/** Request augmented by JwtAuthGuard. */
export interface AuthedRequest extends Request {
  user?: User;
}

/** Injects the authenticated user (or one of its fields) into a handler param. */
export const CurrentUser = createParamDecorator((data: keyof User | undefined, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  const user = req.user;
  if (!user) return undefined;
  return data ? user[data] : user;
});
