import { PrintJobStatus, PrintJobType } from '@hardware-pos/database';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryPrintJobsDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  saleId?: string;

  @IsEnum(PrintJobStatus)
  @IsOptional()
  status?: PrintJobStatus;

  @IsEnum(PrintJobType)
  @IsOptional()
  type?: PrintJobType;
}
