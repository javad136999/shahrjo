import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { PUBLIC_KEY, type AuthedRequest } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Global bearer-token guard. Verifies the short-lived access token and loads
 * the (active) user into the request. Routes marked with @Public() are skipped.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();

    if (isPublic) {
      // Optional auth: public detail endpoints stay open, but a caller with a
      // valid token gets enrichments (owner preview, favorited state, …).
      await this.attachOptionalUser(req);
      return true;
    }

    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw this.unauthorized();

    const user = await this.loadUser(token);
    if (!user) throw this.unauthorized();

    req.user = user;
    return true;
  }

  /** Verifies a token and returns its active user, or null when unusable. */
  private async loadUser(token: string): Promise<User | null> {
    let payload: { sub?: number };
    try {
      payload = await this.jwt.verifyAsync<{ sub: number }>(token);
    } catch {
      return null;
    }
    if (!payload.sub) return null;

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ACTIVE') return null;
    return user;
  }

  /** Best-effort identity on @Public routes: never throws, never blocks. */
  private async attachOptionalUser(req: AuthedRequest): Promise<void> {
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) return;
    try {
      const user = await this.loadUser(token);
      if (user) req.user = user;
    } catch {
      // anonymous access is always allowed here
    }
  }

  private unauthorized(): HttpException {
    return new HttpException(
      { code: 'UNAUTHORIZED', message: 'برای دسترسی ابتدا وارد حساب خود شوید' },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
