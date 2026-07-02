// src/purchase-invoice/dto/filter-purchase-invoice.dto.ts
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { InvoiceStatus, PurchaseInvoiceType } from '@prisma/client';

export class FilterPurchaseInvoiceDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @IsEnum(PurchaseInvoiceType)
  @IsOptional()
  type?: PurchaseInvoiceType;

  @IsString()
  @IsOptional()
  supplierName?: string;

  @IsInt()
  @IsOptional()
  supplierId?: number;

  @IsString()
  @IsOptional()
  invoiceNumber?: string;
}
