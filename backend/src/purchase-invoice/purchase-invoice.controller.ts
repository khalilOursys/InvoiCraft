// src/purchase-invoice/purchase-invoice.controller.ts
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
  UseInterceptors,
  UploadedFile,
  Put,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PurchaseInvoiceService } from './purchase-invoice.service';
import { CreatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { UpdatePurchaseInvoiceDto } from './dto/update-purchase-invoice.dto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { FilterPurchaseInvoiceDto } from './dto/filter-purchase-invoice.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Controller('purchase-invoices')
export class PurchaseInvoiceController {
  constructor(
    private readonly purchaseInvoiceService: PurchaseInvoiceService,
  ) {}

  @Post()
  create(@Body() createPurchaseInvoiceDto: CreatePurchaseInvoiceDto) {
    return this.purchaseInvoiceService.create(createPurchaseInvoiceDto);
  }

  @Get()
  findAll(@Query() filterDto: FilterPurchaseInvoiceDto) {
    return this.purchaseInvoiceService.findAll(filterDto);
  }

  @Get('statistics')
  getStatistics() {
    return this.purchaseInvoiceService.getStatistics();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.purchaseInvoiceService.findOne(id);
  }

  @Get('number/:invoiceNumber')
  findByInvoiceNumber(@Param('invoiceNumber') invoiceNumber: string) {
    return this.purchaseInvoiceService.findByInvoiceNumber(invoiceNumber);
  }

  @Get('supplier/:supplierId')
  findBySupplier(@Param('supplierId', ParseIntPipe) supplierId: number) {
    return this.purchaseInvoiceService.findBySupplier(supplierId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePurchaseInvoiceDto: UpdatePurchaseInvoiceDto,
  ) {
    return this.purchaseInvoiceService.update(id, updatePurchaseInvoiceDto);
  }

  @Put(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.purchaseInvoiceService.updateStatus(id, updateStatusDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.purchaseInvoiceService.remove(id);
  }

  @Post(':id/upload-pdf')
  @UseInterceptors(
    FileInterceptor('pdf', {
      storage: diskStorage({
        destination: './uploads/purchase-invoices',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          return cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Only PDF files are allowed'), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadPdf(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const pdfUrl = `/uploads/purchase-invoices/${file.filename}`;
    return this.purchaseInvoiceService.uploadPdf(id, pdfUrl);
  }

  @Get('filter/date-range')
  filterByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.purchaseInvoiceService.findAll({
      startDate,
      endDate,
    });
  }
}
