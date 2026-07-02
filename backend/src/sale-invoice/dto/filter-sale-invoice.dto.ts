import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsInt,
  IsBoolean,
} from 'class-validator';
import { InvoiceStatus, SaleInvoiceType } from '@prisma/client';
import { Type } from 'class-transformer';

export class FilterSaleInvoiceDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @IsEnum(SaleInvoiceType)
  @IsOptional()
  type?: SaleInvoiceType;

  @IsString()
  @IsOptional()
  clientName?: string;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  clientId?: number;

  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  driverId?: number;

  @IsString()
  @IsOptional()
  driverCIN?: string; // Add driver CIN filter

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  hasDriver?: boolean;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @IsInt()
  @IsOptional()
  shippingNoteId?: number;
}
