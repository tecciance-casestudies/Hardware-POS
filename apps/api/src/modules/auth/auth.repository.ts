import { Injectable } from '@nestjs/common';
import { User } from '@hardware-pos/database';

import { PrismaService } from '../../prisma/prisma.service';

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
}
