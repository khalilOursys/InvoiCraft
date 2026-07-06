// src/dtos/craft-product.dto.ts
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
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class CraftProductMaterialDto {
  @IsInt()
  rawMaterialId: number;

  @IsNumber()
  @Min(0)
  amount: number;
}

export class CreateCraftProductDto {
  @IsString()
  reference: string;

  @IsString()
  name: string;

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
  @Type(() => CraftProductMaterialDto)
  materials: CraftProductMaterialDto[];

  @IsArray()
  @IsInt({ each: true })
  serviceIds: number[]; // Array of service IDs

  // For storing in database (single material)
  @IsOptional()
  @IsInt()
  rawMaterialId?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rawAmount?: number;

  // For storing in database (single service)
  @IsOptional()
  @IsInt()
  serviceId?: number;

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
}

export class SellCraftProductDto {
  @IsNumber()
  @Min(0)
  amount: number;
}

export class UpdateStockDto {
  @IsNumber()
  @Min(0)
  amount: number;
}
