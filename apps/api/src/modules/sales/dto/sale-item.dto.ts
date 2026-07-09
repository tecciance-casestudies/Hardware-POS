import { DiscountType } from '@hardware-pos/database';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class SaleItemInputDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  /** Optional price echo from the client; validated against the cached price. */
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @IsEnum(DiscountType)
  @IsOptional()
  discountType?: DiscountType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountValue?: number;

  @IsString()
  @IsOptional()
  discountReason?: string;

  /** Manager who approved a high discount (from POST /auth/approve-discount). */
  @IsString()
  @IsOptional()
  approvedByUserId?: string;
}
