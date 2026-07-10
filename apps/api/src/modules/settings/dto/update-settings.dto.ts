import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  taxRatePercent?: number;

  @IsBoolean()
  @IsOptional()
  taxInclusive?: boolean;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  highDiscountThresholdPercent?: number;

  @IsString()
  @IsOptional()
  receiptFooter?: string;
}
