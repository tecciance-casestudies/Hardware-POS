import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@hardware-pos/database';

import { PrismaService } from '../../prisma/prisma.service';

export type RefreshTokenWithUser = Prisma.RefreshTokenGetPayload<{ include: { user: true } }>;

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Look up an active user by email (for password login). */
  findActiveByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { email, isActive: true } });
  }

  /** Active users in a tenant that have a PIN set (for PIN login / approval). */
  findActivePinUsers(tenantId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { tenantId, isActive: true, pinHash: { not: null } },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  // ── refresh tokens ─────────────────────────────────────────────────────

  async createRefreshToken(
    tenantId: string,
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.refreshToken.create({ data: { tenantId, userId, tokenHash, expiresAt } });
  }

  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenWithUser | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  /** Kill every live session for a user (used on refresh-token replay). */
  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Opportunistic cleanup of long-dead rows for a user. */
  async deleteExpiredRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
  }
}
