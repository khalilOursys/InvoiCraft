import {
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsInt,
  IsIn,
  IsArray,
  ValidateNested,
  IsDate,
  IsEnum,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductionOrderMaterialDto {
  @IsInt()
  rawMaterialId: number;

  @IsNumber()
  @Min(0)
  amount: number;
}

export enum ProductionOrderStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ON_HOLD = 'ON_HOLD',
}

export enum ProductionOrderPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export class CreateProductionOrderDto {
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
  @Type(() => ProductionOrderMaterialDto)
  materials: ProductionOrderMaterialDto[];

  @IsArray()
  @IsInt({ each: true })
  serviceIds: number[];

  @IsNumber()
  @Min(0)
  marginPercent: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  vat: number;

  // Production Order specific fields
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  orderDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expectedDelivery?: Date;

  @IsOptional()
  @IsEnum(ProductionOrderStatus)
  status?: ProductionOrderStatus;

  @IsOptional()
  @IsEnum(ProductionOrderPriority)
  priority?: ProductionOrderPriority;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityProduced?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  wasteAmount?: number;
}
