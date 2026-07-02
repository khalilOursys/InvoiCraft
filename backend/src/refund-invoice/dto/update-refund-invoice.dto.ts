import { PartialType } from '@nestjs/mapped-types';
import { CreateSaleRefundDto } from './create-refund-invoice.dto';

export class UpdateRefundInvoiceDto extends PartialType(CreateSaleRefundDto) {}
