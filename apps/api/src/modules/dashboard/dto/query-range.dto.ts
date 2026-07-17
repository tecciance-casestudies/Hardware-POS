import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Optional date window + limit shared by the dashboard aggregation routes. */
export class QueryRangeDto {
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  from?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  to?: Date;

  @IsIn(['day', 'hour'])
  @IsOptional()
  interval?: 'day' | 'hour';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number;

  /** 'true' scopes the query to the requesting user's own sales. */
  @IsIn(['true', 'false'])
  @IsOptional()
  mine?: string;
}
