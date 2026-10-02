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
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw this.unauthorized();

    let payload: { sub?: number };
    try {
      payload = await this.jwt.verifyAsync<{ sub: number }>(token);
    } catch {
      throw this.unauthorized();
    }
    if (!payload.sub) throw this.unauthorized();

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ACTIVE') throw this.unauthorized();

    req.user = user;
    return true;
  }

  private unauthorized(): HttpException {
    return new HttpException(
      { code: 'UNAUTHORIZED', message: 'برای دسترسی ابتدا وارد حساب خود شوید' },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
