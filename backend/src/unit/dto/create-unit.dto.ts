// src/unit/dto/unit.dto.ts

import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';

export class CreateUnitDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  symbol: string;

  @IsString()
  family: string;

  @IsNumber()
  @Min(0)
  conversionToBase: number;

  @IsInt()
  @IsOptional()
  baseUnitId?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isStandard?: boolean;
}
