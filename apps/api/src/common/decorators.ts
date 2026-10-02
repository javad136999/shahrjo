import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Request } from 'express';

export const PUBLIC_KEY = 'isPublic';
export const PERMISSIONS_KEY = 'requiredPermissions';

/** Marks a route as accessible without an access token (OTP endpoints). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/** Requires the given permission codes (checked against role_permissions by PermissionsGuard). */
export const RequirePermissions = (...codes: string[]) => SetMetadata(PERMISSIONS_KEY, codes);

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
