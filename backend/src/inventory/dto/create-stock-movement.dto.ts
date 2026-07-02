import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  Min,
} from 'class-validator';
import { StockMovementType, StockMovementStatus } from '@prisma/client';

export class CreateStockMovementDto {
  @IsOptional()
  @IsNumber()
  productId: number;

  @IsNotEmpty()
  @IsEnum(StockMovementType)
  type: StockMovementType;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsEnum(StockMovementStatus)
  status?: StockMovementStatus;

  @IsOptional()
  @IsNumber()
  purchaseInvoiceItemId?: number;

  @IsOptional()
  @IsNumber()
  saleInvoiceItemId?: number;

  @IsOptional()
  @IsNumber()
  orderItemId?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
