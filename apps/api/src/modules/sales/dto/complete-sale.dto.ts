import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { SaleItemInputDto } from './sale-item.dto';
import { SalePaymentInputDto } from './sale-payment.dto';

/**
 * Complete a sale either by finishing an existing draft (`saleId`) or by passing
 * the full cart in one shot (`branchId` + `items`). `payments` may be empty for
 * a full credit sale.
 */
export class CompleteSaleDto {
  @IsString()
  @IsOptional()
  saleId?: string;

  @ValidateIf((o: CompleteSaleDto) => !o.saleId)
  @IsString()
  branchId?: string;

  @IsString()
  @IsOptional()
  registerId?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @ValidateIf((o: CompleteSaleDto) => !o.saleId)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items?: SaleItemInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalePaymentInputDto)
  payments!: SalePaymentInputDto[];
}
