import { SyncStatus } from '@hardware-pos/database';
import { IsEnum, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QuerySalesDto extends PaginationQueryDto {
  /** Optionally filter the sales history by sync status (e.g. FAILED). */
  @IsEnum(SyncStatus)
  @IsOptional()
  syncStatus?: SyncStatus;
}
