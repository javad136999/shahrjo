import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, type AuthedRequest } from '../common/decorators';
import { RbacService } from '../rbac/rbac.service';

/**
 * Checks @RequirePermissions(...) codes against the user's role permissions.
 * Registered after JwtAuthGuard so req.user is already resolved.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) {
      throw new HttpException(
        { code: 'UNAUTHORIZED', message: 'برای دسترسی ابتدا وارد حساب خود شوید' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const permissions = await this.rbac.getPermissions(req.user.id);
    const allowed = required.every((code) => permissions.includes(code));
    if (!allowed) {
      throw new HttpException(
        { code: 'FORBIDDEN', message: 'دسترسی کافی ندارید', details: { required } },
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
