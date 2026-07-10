import { PaymentMethod } from '@hardware-pos/database';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  saleId!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @IsOptional()
  reference?: string;
}
