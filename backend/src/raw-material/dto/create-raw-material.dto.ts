// src/dtos/raw-material.dto.ts
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsInt,
  IsIn,
} from 'class-validator';

export class CreateRawMaterialDto {
  @IsString()
  reference: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Changed from unit to unitId
  @IsInt()
  @IsOptional()
  unitId: number;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsNumber()
  @Min(0)
  purchasePrice: number;

  /* @IsNumber()
  @Min(0)
  @Max(100)
  vat: number; */
}
