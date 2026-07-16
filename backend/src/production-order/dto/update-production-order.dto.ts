import { PartialType } from '@nestjs/mapped-types';
import { CreateProductionOrderDto } from './create-production-order.dto';
import {
  IsOptional,
  IsNumber,
  IsDate,
  IsEnum,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ProductionOrderStatus,
  ProductionOrderPriority,
} from './create-production-order.dto';

export class UpdateProductionOrderDto extends PartialType(
  CreateProductionOrderDto,
) {
  totalCost?: number;
  salePrice?: number;

  // Additional fields for status management
  @IsOptional()
  @IsEnum(ProductionOrderStatus)
  status?: ProductionOrderStatus;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  completedAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  cancelledAt?: Date;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityProduced?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  wasteAmount?: number;
}
