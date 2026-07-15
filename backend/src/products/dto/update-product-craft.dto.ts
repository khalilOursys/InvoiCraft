// src/products/dto/update-product-craft.dto.ts

import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsInt,
  IsIn,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCraftProductMaterialDto {
  @IsInt()
  @IsNotEmpty()
  rawMaterialId: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  internalCode?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  stock?: number;

  @IsNumber()
  @IsOptional()
  minStock?: number;

  @IsNumber()
  @IsOptional()
  purchasePrice?: number;

  @IsNumber()
  @IsOptional()
  marginPercent?: number;

  @IsNumber()
  @IsOptional()
  salePrice?: number;

  @IsNumber()
  @IsOptional()
  priceIncludingTax?: number;

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsNumber()
  @IsOptional()
  vat?: number;

  @IsNumber()
  @IsOptional()
  fodec?: number;

  @IsNumber()
  @IsOptional()
  categoryId?: number;

  @IsNumber()
  @IsOptional()
  brandId?: number;

  @IsString()
  @IsOptional()
  img?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCraftProductDto {
  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['mg', 'ml', 'g', 'L', 'kg', 'unit'])
  unit: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsOptional()
  @IsInt()
  productId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateCraftProductMaterialDto)
  @IsOptional()
  materials?: UpdateCraftProductMaterialDto[];

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  serviceIds?: number[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  marginPercent?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  vat?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minStock?: number;

  @IsOptional()
  @IsString()
  img?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  totalCost?: number;

  @IsNumber()
  @IsOptional()
  salePrice?: number;
}

export class UpdateProductCraftDto {
  @ValidateNested()
  @Type(() => UpdateProductDto)
  @IsOptional()
  product?: UpdateProductDto;

  @ValidateNested()
  @Type(() => UpdateCraftProductDto)
  @IsOptional()
  craftProduct?: UpdateCraftProductDto;
}
