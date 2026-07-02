import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { CreateSaleRefundDto } from './dto/create-refund-invoice.dto';
import { UpdateRefundInvoiceDto } from './dto/update-refund-invoice.dto';
import { RefundInvoiceService } from './refund-invoice.service';

@Controller('sale-refunds')
export class SaleRefundController {
  constructor(private readonly service: RefundInvoiceService) {}

  @Post()
  create(@Body() dto: CreateSaleRefundDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRefundInvoiceDto,
  ) {
    return this.service.update(id, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
