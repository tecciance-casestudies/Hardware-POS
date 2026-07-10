import { IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryProductsDto extends PaginationQueryDto {
  /** Free-text search across name, SKU, and barcode. */
  @IsString()
  @IsOptional()
  search?: string;
}
