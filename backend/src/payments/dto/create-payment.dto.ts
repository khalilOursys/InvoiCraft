// src/payments/dto/create-payment.dto.ts
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsDateString,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  // Check fields - required when method is CHECK
  @IsOptional()
  @IsDateString()
  checkDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  checkBank?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  checkNumber?: string;

  // Trait (canbiala) fields - required when method is TRAIT
  @IsOptional()
  @IsDateString()
  traitDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  traitNumber?: string;

  // File upload
  @IsOptional()
  @IsString()
  receiptFile?: string;

  @IsOptional()
  @IsString()
  receiptFileName?: string;

  @IsOptional()
  @IsNumber()
  purchaseInvoiceId?: number;

  @IsOptional()
  @IsNumber()
  supplierId?: number;

  @IsOptional()
  @IsNumber()
  saleInvoiceId?: number;

  @IsOptional()
  @IsNumber()
  clientId?: number;

  @IsOptional()
  @IsDateString()
  createdAt?: string;
}
