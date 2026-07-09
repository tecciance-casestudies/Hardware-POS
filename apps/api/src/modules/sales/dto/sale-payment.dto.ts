import { PaymentMethod } from '@hardware-pos/database';
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class SalePaymentInputDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsOptional()
  reference?: string;
}
