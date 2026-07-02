import { Module } from '@nestjs/common';
import { SaleInvoiceService } from './sale-invoice.service';
import { SaleInvoiceController } from './sale-invoice.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SaleInvoiceController],
  providers: [SaleInvoiceService],
  exports: [SaleInvoiceService],
})
export class SaleInvoiceModule {}
