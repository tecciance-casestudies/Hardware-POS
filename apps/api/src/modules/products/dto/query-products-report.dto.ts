import { IsIn } from 'class-validator';

import { QueryProductsDto } from './query-products.dto';

/**
 * Filters for the exported stock report — identical to the list filters
 * (pagination fields are inherited but ignored; the report covers every
 * matching product up to the server-side cap) plus the output format.
 */
export class QueryProductsReportDto extends QueryProductsDto {
  @IsIn(['pdf', 'xlsx'])
  format!: 'pdf' | 'xlsx';
}
