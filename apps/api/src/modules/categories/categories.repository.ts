import { Injectable } from '@nestjs/common';
import { Prisma } from '@hardware-pos/database';

import { PrismaService } from '../../prisma/prisma.service';

const categorySelect = {
  id: true,
  name: true,
  parentId: true,
  isActive: true,
  quickbooksItemId: true,
  _count: { select: { products: true } },
} satisfies Prisma.ProductCategorySelect;

export type CategoryWithCount = Prisma.ProductCategoryGetPayload<{ select: typeof categorySelect }>;

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyByTenant(tenantId: string): Promise<CategoryWithCount[]> {
    return this.prisma.productCategory.findMany({
      where: { tenantId },
      select: categorySelect,
      orderBy: { name: 'asc' },
    });
  }
}
