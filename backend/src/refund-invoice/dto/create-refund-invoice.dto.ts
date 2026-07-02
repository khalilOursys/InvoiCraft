import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaleRefundItemDto {
  @IsInt()
  @IsNotEmpty()
  productId: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;
  @IsNumber()
  @Min(0)
  @IsOptional()
  vatRate?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  vatAmount?: number;
}

export class CreateSaleRefundDto {
  @IsString()
  @IsOptional()
  invoiceNumber: string;

  @IsString()
  @IsOptional()
  date: string | Date;

  @IsInt()
  @IsOptional()
  clientId: number;

  @IsInt()
  @IsNotEmpty()
  originalInvoiceId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleRefundItemDto)
  items: SaleRefundItemDto[];

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
