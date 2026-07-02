// src/sale-invoice/dto/create-sale-invoice.dto.ts

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
  IsDateString,
  IsPositive,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SaleInvoiceType, InvoiceStatus } from '@prisma/client';

export class CreateSaleInvoiceItemDto {
  @IsInt()
  @IsNotEmpty()
  productId: number;

  @IsInt()
  quantity: number;

  @IsNumber()
  @Min(0)
  @IsPositive()
  price: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  vatRate?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  vatAmount?: number;

  @IsInt()
  @IsOptional()
  shippingNoteItemId?: number;
}

export class CreateSaleInvoiceDto {
  @IsString()
  @IsNotEmpty()
  invoiceNumber: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsEnum(SaleInvoiceType)
  @IsOptional()
  type?: SaleInvoiceType;

  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @IsInt()
  @IsOptional()
  clientId?: number;

  @IsInt()
  @IsOptional()
  driverId?: number;

  @IsInt()
  @IsOptional()
  shippingNoteId?: number;

  // NEW: Array of delivery note IDs to consolidate into this invoice
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  deliveryNoteIds?: number[];

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  cityIds?: number[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleInvoiceItemDto)
  @IsNotEmpty()
  items: CreateSaleInvoiceItemDto[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  totalHT?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  totalTTC?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxStamp?: number;

  @IsString()
  @IsOptional()
  pdfUrl?: string;
}
