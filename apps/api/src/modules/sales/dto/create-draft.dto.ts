import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

import { SaleItemInputDto } from './sale-item.dto';

export class CreateDraftDto {
  @IsString()
  branchId!: string;

  @IsString()
  @IsOptional()
  registerId?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items!: SaleItemInputDto[];
}
