import { IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class UpdateStockAlertDto {
  @IsOptional()
  @IsNumber()
  minThreshold?: number;

  @IsOptional()
  @IsNumber()
  criticalThreshold?: number;

  @IsOptional()
  @IsNumber()
  maxThreshold?: number;

  @IsOptional()
  @IsNumber()
  reorderQuantity?: number;

  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyDashboard?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
