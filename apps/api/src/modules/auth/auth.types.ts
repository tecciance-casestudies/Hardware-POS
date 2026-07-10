import { UserRole } from '@hardware-pos/database';

/** Signed into the JWT and re-hydrated on each request. */
export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: UserRole;
}

/** Attached to `request.user` by the JWT guard. */
export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: UserRole;
}

export interface AuthTokenResult {
  token: string;
  user: {
    id: string;
    tenantId: string;
    name: string;
    email: string | null;
    role: UserRole;
  };
}
