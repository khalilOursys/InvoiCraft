// src/payments/payments.controller.ts
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  async create(@Body() createPaymentDto: CreatePaymentDto) {
    return await this.paymentsService.create(createPaymentDto);
  }

  @Get()
  async findAll(
    @Query('type') type?: 'purchase' | 'sale' | 'all',
    @Query('entityId') entityId?: string,
  ) {
    return await this.paymentsService.findAll(type, entityId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.paymentsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return await this.paymentsService.update(id, updatePaymentDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.paymentsService.remove(id);
  }

  @Get('supplier/:supplierId')
  async findBySupplier(@Param('supplierId', ParseIntPipe) supplierId: number) {
    return await this.paymentsService.findBySupplier(supplierId);
  }

  @Get('client/:clientId')
  async findByClient(@Param('clientId', ParseIntPipe) clientId: number) {
    return await this.paymentsService.findByClient(clientId);
  }

  @Get('purchase-invoice/:invoiceId')
  async findByPurchaseInvoice(
    @Param('invoiceId', ParseIntPipe) invoiceId: number,
  ) {
    return await this.paymentsService.findByPurchaseInvoice(invoiceId);
  }

  @Get('sale-invoice/:invoiceId')
  async findBySaleInvoice(@Param('invoiceId', ParseIntPipe) invoiceId: number) {
    return await this.paymentsService.findBySaleInvoice(invoiceId);
  }

  @Get('summary/today')
  async getTodaySummary() {
    return await this.paymentsService.getTodaySummary();
  }
}
