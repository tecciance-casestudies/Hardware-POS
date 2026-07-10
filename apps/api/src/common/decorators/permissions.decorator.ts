import { SetMetadata } from '@nestjs/common';

import { Permission } from '../../modules/auth/permissions';

export const PERMISSIONS_KEY = 'permissions';

/** Require one or more permissions on a route (checked by PermissionsGuard). */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
