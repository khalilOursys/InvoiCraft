import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  BadRequestException,
  Put,
} from '@nestjs/common';
import { SaleInvoiceService } from './sale-invoice.service';
import { CreateSaleInvoiceDto } from './dto/create-sale-invoice.dto';
import { UpdateSaleInvoiceDto } from './dto/update-sale-invoice.dto';
import { FilterSaleInvoiceDto } from './dto/filter-sale-invoice.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { SaleInvoiceType } from '@prisma/client';

@Controller('sale-invoices')
export class SaleInvoiceController {
  constructor(private readonly saleInvoiceService: SaleInvoiceService) {}

  @Post()
  create(@Body() createSaleInvoiceDto: CreateSaleInvoiceDto) {
    return this.saleInvoiceService.create(createSaleInvoiceDto);
  }

  @Get()
  findAll(@Query() filterDto: FilterSaleInvoiceDto) {
    return this.saleInvoiceService.findAll(filterDto);
  }

  @Get('statistics')
  getStatistics() {
    return this.saleInvoiceService.getStatistics();
  }

  // Generic endpoint that accepts type as parameter
  @Get('generate-number/:type')
  async generateNumberByType(@Param('type') type: string) {
    let invoiceType: SaleInvoiceType;

    switch (type.toUpperCase()) {
      case 'SALE_INVOICE':
        invoiceType = SaleInvoiceType.SALE_INVOICE;
        break;
      case 'DELIVERY_NOTE':
        invoiceType = SaleInvoiceType.DELIVERY_NOTE;
        break;
      case 'QUOTATION':
        invoiceType = SaleInvoiceType.QUOTATION;
        break;
      case 'SHIPPING_NOTE_INVOICE':
        invoiceType = SaleInvoiceType.SHIPPING_NOTE_INVOICE;
        break;
      default:
        throw new BadRequestException(`Invalid invoice type: ${type}`);
    }

    const nextNumber =
      await this.saleInvoiceService.generateInvoiceNumber(invoiceType);
    return {
      type: invoiceType,
      nextInvoiceNumber: nextNumber,
    };
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.saleInvoiceService.findOne(id);
  }

  @Get('number/:invoiceNumber')
  findByInvoiceNumber(@Param('invoiceNumber') invoiceNumber: string) {
    return this.saleInvoiceService.findByInvoiceNumber(invoiceNumber);
  }

  @Get('client/:clientId')
  findByClient(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.saleInvoiceService.findByClient(clientId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSaleInvoiceDto: UpdateSaleInvoiceDto,
  ) {
    return this.saleInvoiceService.update(id, updateSaleInvoiceDto);
  }

  @Put(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.saleInvoiceService.updateStatus(id, updateStatusDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.saleInvoiceService.remove(id);
  }

  @Get('filter/date-range')
  filterByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.saleInvoiceService.findAll({
      startDate,
      endDate,
    });
  }

  // NEW FUNCTIONS ADDED BELOW - NO EXISTING CODE MODIFIED

  @Get('shipping-note/:shippingNoteId/delivery-notes')
  getDeliveryNotesForShippingNote(
    @Param('shippingNoteId', ParseIntPipe) shippingNoteId: number,
  ) {
    return this.saleInvoiceService.getDeliveryNotesForShippingNote(
      shippingNoteId,
    );
  }

  @Get('shipping-note/:shippingNoteId/remaining-quantities')
  getShippingNoteRemainingQuantities(
    @Param('shippingNoteId', ParseIntPipe) shippingNoteId: number,
  ) {
    return this.saleInvoiceService.getShippingNoteRemainingQuantities(
      shippingNoteId,
    );
  }

  @Get('items/:itemId/traceability')
  getItemTraceability(@Param('itemId', ParseIntPipe) itemId: number) {
    return this.saleInvoiceService.getItemTraceability(itemId);
  }

  @Get('available-drivers')
  getAvailableDrivers() {
    return this.saleInvoiceService.getAvailableDrivers();
  }

  @Get('unpaid/by-customer-driver')
  async getUnpaidDeliveryInvoicesForCustomerAndDriver(
    @Query('clientId', ParseIntPipe) clientId: number,
    @Query('driverId', ParseIntPipe) driverId: number,
  ) {
    return this.saleInvoiceService.getUnpaidDeliveryInvoicesForCustomerAndDriver(
      clientId,
      driverId,
    );
  }

  @Get('unpaid')
  async getUnpaidDeliveryInvoices(
    @Query('clientId') clientId?: string,
    @Query('driverId') driverId?: string,
  ) {
    const parsedClientId = clientId ? parseInt(clientId) : undefined;
    const parsedDriverId = driverId ? parseInt(driverId) : undefined;

    return this.saleInvoiceService.getUnpaidDeliveryInvoices(
      parsedClientId,
      parsedDriverId,
    );
  }

  // ==================== PAYMENT API ENDPOINTS ====================

  /**
   * Get payment details for a single invoice
   * GET /sale-invoices/:id/payments
   */
  @Get(':id/payments')
  getInvoicePaymentDetails(@Param('id', ParseIntPipe) id: number) {
    return this.saleInvoiceService.getInvoicePaymentDetails(id);
  }

  /**
   * Get all sale invoices for a client with payment calculations
   * GET /sale-invoices/client/:clientId/payments
   */
  @Get('client/:clientId/payments')
  getClientInvoicesWithPayments(
    @Param('clientId', ParseIntPipe) clientId: number,
  ) {
    return this.saleInvoiceService.getClientInvoicesWithPayments(clientId);
  }

  /**
   * Get client balance
   * GET /sale-invoices/client/:clientId/balance
   */
  @Get('client/:clientId/balance')
  getClientBalance(@Param('clientId', ParseIntPipe) clientId: number) {
    return this.saleInvoiceService.getClientBalance(clientId);
  }

  /**
   * Get payment summary for all invoices
   * GET /sale-invoices/payments/summary
   */
  @Get('payments/summary')
  getAllPaymentSummary() {
    return this.saleInvoiceService.getAllSaleInvoicesPaymentSummary();
  }

  /**
   * Get overdue invoices
   * GET /sale-invoices/overdue?clientId=1
   */
  @Get('overdue')
  getOverdueInvoices(@Query('clientId') clientId?: string) {
    const parsedClientId = clientId ? parseInt(clientId) : undefined;
    return this.saleInvoiceService.getOverdueSaleInvoices(parsedClientId);
  }

  /**
   * Bulk update payment status
   * POST /sale-invoices/payments/bulk-update
   * Body: { "invoiceIds": [1, 2, 3] }
   */
  @Post('payments/bulk-update')
  bulkUpdatePaymentStatus(@Body() body: { invoiceIds: number[] }) {
    return this.saleInvoiceService.updateBulkPaymentStatus(body.invoiceIds);
  }
}
