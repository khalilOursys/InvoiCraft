import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  taxNumber?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  bankRib?: string;

  @IsString()
  @IsOptional()
  email?: string; // Added: Optional email field

  @IsNumber()
  @IsOptional()
  cityId?: number; // Added: Optional cityId field
}
