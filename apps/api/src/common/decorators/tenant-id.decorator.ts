import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { AuthenticatedUser } from '../../modules/auth/auth.types';

/**
 * Resolves the current tenant id.
 *
 * Prefers the authenticated user's tenant (set by JwtAuthGuard). Falls back to
 * the `x-tenant-id` header for public, pre-auth flows such as PIN login where a
 * POS terminal supplies its tenant.
 */
export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();

  if (request.user?.tenantId) {
    return request.user.tenantId;
  }

  const header = request.headers['x-tenant-id'];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }

  throw new BadRequestException('Unable to resolve tenant (no session or x-tenant-id header)');
});
