import { Module } from '@nestjs/common';

import { SyncModule } from '../sync/sync.module';
import { ProductsController } from './products.controller';
import { ProductsImportService } from './products-import.service';
import { ProductsReportService } from './products-report.service';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

@Module({
  imports: [SyncModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository, ProductsImportService, ProductsReportService],
  exports: [ProductsService],
})
export class ProductsModule {}
