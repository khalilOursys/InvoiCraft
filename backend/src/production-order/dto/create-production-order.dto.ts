// src/production-order/dto/create-production-order.dto.ts

import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductionOrderStatus, ProductionOrderPriority } from '@prisma/client';

export class ProductionOrderMaterialDto {
  @IsInt()
  rawMaterialId: number;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsInt()
  unitId: number; // Unit for this specific material
}

export class CreateProductionOrderDto {
  @IsInt()
  unitId: number;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsInt()
  @IsOptional()
  productId?: number;

  @IsNumber()
  @IsOptional()
  marginPercent?: number;

  @IsNumber()
  @IsOptional()
  vat?: number;

  @IsDateString()
  @IsOptional()
  orderDate?: string;

  @IsDateString()
  @IsOptional()
  expectedDelivery?: string;

  @IsEnum(ProductionOrderStatus)
  @IsOptional()
  status?: ProductionOrderStatus;

  @IsEnum(ProductionOrderPriority)
  @IsOptional()
  priority?: ProductionOrderPriority;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsOptional()
  quantityProduced?: number;

  @IsNumber()
  @IsOptional()
  wasteAmount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductionOrderMaterialDto)
  @IsOptional()
  materials?: ProductionOrderMaterialDto[];

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  serviceIds?: number[];
}
