import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Client IP for rate limiting. Behind Nginx the proxy sets X-Real-IP /
 * X-Forwarded-For; direct connections fall back to the socket address.
 */
export function clientIpOf(req: Request): string {
  const headers = req.headers as Record<string, string | undefined>;
  const real = headers['x-real-ip'];
  if (real) return real.trim();
  const fwd = headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return clientIpOf(req);
});
