import { SyncStatus } from '@hardware-pos/database';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QuerySyncLogsDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  entityType?: string;

  @IsEnum(SyncStatus)
  @IsOptional()
  status?: SyncStatus;
}
