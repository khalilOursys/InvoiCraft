import { Module } from '@nestjs/common';
import { RefundInvoiceService } from './refund-invoice.service';
import { SaleRefundController } from './refund-invoice.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SaleRefundController],
  providers: [RefundInvoiceService],
  exports: [RefundInvoiceService],
})
export class RefundInvoiceModule {}
