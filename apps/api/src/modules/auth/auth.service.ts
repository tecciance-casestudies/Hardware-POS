import { createHash, randomBytes } from 'node:crypto';

import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@hardware-pos/database';
import * as bcrypt from 'bcryptjs';

import { AuthRepository } from './auth.repository';
import { AuthTokenResult, JwtPayload } from './auth.types';
import { Permission, ROLE_PERMISSIONS } from './permissions';
import { LoginDto } from './dto/login.dto';
import { PinLoginDto } from './dto/pin-login.dto';

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CurrentUserView {
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  role: UserRole;
  branchId: string | null;
  permissions: Permission[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Email + password login (owner / admin / accountant). */
  async login(dto: LoginDto): Promise<AuthTokenResult> {
    const user = await this.authRepository.findActiveByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueToken(user);
  }

  /** PIN login (cashier / manager), scoped to the given tenant. */
  async pinLogin(tenantId: string, dto: PinLoginDto): Promise<AuthTokenResult> {
    const user = await this.findByPin(tenantId, dto.pin);
    if (!user) {
      throw new UnauthorizedException('Invalid PIN');
    }
    return this.issueToken(user);
  }

  /**
   * Exchange a live refresh token for a new access + refresh pair.
   * Tokens rotate on every use; presenting an already-rotated (revoked)
   * token is treated as replay and kills every session for that user.
   */
  async refresh(refreshToken: string): Promise<AuthTokenResult> {
    const row = await this.authRepository.findRefreshTokenByHash(hashRefreshToken(refreshToken));
    if (!row || !row.user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (row.revokedAt) {
      await this.authRepository.revokeAllRefreshTokensForUser(row.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (row.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.authRepository.revokeRefreshToken(row.id);
    await this.authRepository.deleteExpiredRefreshTokens(row.userId);
    return this.issueToken(row.user);
  }

  /** Revoke a refresh token (sign-out). Idempotent — unknown tokens are ignored. */
  async logout(refreshToken: string): Promise<void> {
    const row = await this.authRepository.findRefreshTokenByHash(hashRefreshToken(refreshToken));
    if (row && !row.revokedAt) {
      await this.authRepository.revokeRefreshToken(row.id);
    }
  }

  /** Resolve the full current-user view for GET /auth/me. */
  async getCurrentUser(userId: string): Promise<CurrentUserView> {
    const user = await this.authRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new NotFoundException('User not found');
    }
    return this.toCurrentUserView(user);
  }

  /** Find an active tenant user by PIN (used by discount approval). */
  findUserByPin(tenantId: string, pin: string): Promise<User | null> {
    return this.findByPin(tenantId, pin);
  }

  /** Load a user by id (used to check a recorded approver's discount limit). */
  findUserById(id: string): Promise<User | null> {
    return this.authRepository.findById(id);
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private async findByPin(tenantId: string, pin: string): Promise<User | null> {
    const candidates = await this.authRepository.findActivePinUsers(tenantId);
    for (const candidate of candidates) {
      if (candidate.pinHash && (await bcrypt.compare(pin, candidate.pinHash))) {
        return candidate;
      }
    }
    return null;
  }

  private async issueToken(user: User): Promise<AuthTokenResult> {
    const payload: JwtPayload = { sub: user.id, tenantId: user.tenantId, role: user.role };
    const token = await this.jwtService.signAsync(payload);

    const refreshToken = randomBytes(48).toString('base64url');
    const ttlDays = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    await this.authRepository.createRefreshToken(
      user.tenantId,
      user.id,
      hashRefreshToken(refreshToken),
      expiresAt,
    );

    await this.authRepository.touchLastLogin(user.id);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  private toCurrentUserView(user: User): CurrentUserView {
    return {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      permissions: [...(ROLE_PERMISSIONS[user.role] ?? [])],
    };
  }
}
