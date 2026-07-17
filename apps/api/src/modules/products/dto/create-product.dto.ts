import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  sku?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  barcode?: string;

  /** Batch grouping: family key shared by sibling batches (e.g. tile code "9122"). */
  @IsString()
  @IsOptional()
  @MaxLength(80)
  baseSku?: string;

  /** Batch identifier within the baseSku family (e.g. "LT", "HL1"). */
  @IsString()
  @IsOptional()
  @MaxLength(40)
  batchCode?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  brand?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  subcategoryId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  unitType?: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  costPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  quantityOnHand?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  reorderLevel?: number;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  imageAltText?: string;

  @IsBoolean()
  @IsOptional()
  trackInventory?: boolean;

  @IsBoolean()
  @IsOptional()
  taxable?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresWarehousePickup?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  /** Save as an unfinished draft — hidden from the POS until published. */
  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;
}
