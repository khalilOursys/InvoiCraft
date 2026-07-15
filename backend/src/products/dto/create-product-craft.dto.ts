// src/products/dto/create-product-craft.dto.ts

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

export class CreateCraftProductMaterialDto {
  @IsInt()
  @IsNotEmpty()
  rawMaterialId: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;
}

export class CreateProductDto {
  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  internalCode?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

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
  @IsNotEmpty()
  purchasePrice: number;

  @IsNumber()
  @IsNotEmpty()
  marginPercent: number;

  @IsNumber()
  @IsNotEmpty()
  salePrice: number;

  @IsNumber()
  @IsNotEmpty()
  priceIncludingTax: number;

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
  @IsNotEmpty()
  categoryId: number;

  @IsNumber()
  @IsOptional()
  brandId?: number;

  @IsString()
  @IsOptional()
  img?: string;
}

export class CreateCraftProductDto {
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
  amount: number;

  @IsOptional()
  @IsInt()
  productId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCraftProductMaterialDto)
  @IsOptional()
  materials?: CreateCraftProductMaterialDto[];

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  serviceIds?: number[];

  @IsNumber()
  @Min(0)
  marginPercent: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  vat: number;

  @IsNumber()
  @Min(0)
  minStock: number;

  @IsOptional()
  @IsString()
  img?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateProductCraftDto {
  @ValidateNested()
  @Type(() => CreateProductDto)
  @IsOptional()
  product?: CreateProductDto;

  @ValidateNested()
  @Type(() => CreateCraftProductDto)
  @IsOptional()
  craftProduct?: CreateCraftProductDto;

  @IsBoolean()
  @IsOptional()
  createLinkedProduct?: boolean;
}
