// src/inventory/dto/update-stock-movement.dto.ts
import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { StockMovementStatus } from '@prisma/client';

export class UpdateStockMovementDto {
  @IsOptional()
  @IsEnum(StockMovementStatus)
  status?: StockMovementStatus;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
