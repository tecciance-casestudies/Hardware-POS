import { IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QueryCustomersDto extends PaginationQueryDto {
  /** Free-text search across name, email, and phone. */
  @IsString()
  @IsOptional()
  search?: string;
}
