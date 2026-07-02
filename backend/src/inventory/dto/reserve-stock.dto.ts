import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class ReserveStockDto {
  @IsNotEmpty()
  @IsNumber()
  productId: number;

  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsNumber()
  orderId?: number;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsNumber()
  expirationMinutes?: number; // Default 30 minutes
}
