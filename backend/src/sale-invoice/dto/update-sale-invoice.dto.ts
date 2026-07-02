import { PartialType } from '@nestjs/mapped-types';
import { CreateSaleInvoiceDto } from './create-sale-invoice.dto';

export class UpdateSaleInvoiceDto extends PartialType(CreateSaleInvoiceDto) {}
