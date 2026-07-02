// src/purchase-invoice/dto/create-purchase-invoice.dto.ts
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseInvoiceType, InvoiceStatus } from '@prisma/client';

export class CreatePurchaseInvoiceItemDto {
  @IsInt()
  @IsNotEmpty()
  productId: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;
}

export class CreatePurchaseInvoiceDto {
  @IsString()
  @IsNotEmpty()
  invoiceNumber: string;

  @IsString()
  @IsNotEmpty()
  date: string | Date;

  @IsEnum(PurchaseInvoiceType)
  @IsOptional()
  type?: PurchaseInvoiceType;

  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @IsInt()
  @IsNotEmpty()
  supplierId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseInvoiceItemDto)
  items: CreatePurchaseInvoiceItemDto[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  totalHT?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  totalTTC?: number;

  @IsString()
  @IsOptional()
  pdfUrl?: string;
}
