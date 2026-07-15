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
  /** Short-lived JWT access token. */
  token: string;
  /** Long-lived opaque refresh token — exchange at POST /auth/refresh. */
  refreshToken: string;
  user: {
    id: string;
    tenantId: string;
    name: string;
    email: string | null;
    role: UserRole;
  };
}
