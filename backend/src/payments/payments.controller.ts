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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('receiptFile'))
  async create(
    @Body() createPaymentDto: CreatePaymentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return await this.paymentsService.create(createPaymentDto, file);
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
  @UseInterceptors(FileInterceptor('receiptFile'))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePaymentDto: UpdatePaymentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return await this.paymentsService.update(id, updatePaymentDto, file);
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
