import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Client IP for rate limiting. Behind Nginx the proxy sets X-Real-IP /
 * X-Forwarded-For; direct connections fall back to the socket address.
 */
export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; ip?: string; socket?: { remoteAddress?: string } }>();
  const real = req.headers['x-real-ip'];
  if (real) return real.trim();
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
});
