import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaleInvoiceType, InvoiceStatus } from '@prisma/client';
import {
  CreateSaleRefundDto,
  SaleRefundItemDto,
} from './dto/create-refund-invoice.dto';
import { UpdateRefundInvoiceDto } from './dto/update-refund-invoice.dto';

@Injectable()
export class RefundInvoiceService {
  constructor(private prisma: PrismaService) {}

  /** CREATE REFUND */
  async create(dto: CreateSaleRefundDto) {
    const { items, clientId, originalInvoiceId, ...invoiceData } = dto;

    /* const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) throw new NotFoundException('Client not found'); */

    const originalInvoice = await this.prisma.saleInvoice.findUnique({
      where: { id: originalInvoiceId },
      include: { items: true },
    });
    if (!originalInvoice)
      throw new NotFoundException('Original invoice not found');

    // Validate products exist
    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product)
        throw new NotFoundException(`Product ${item.productId} not found`);
    }

    let totalHT = 0,
      totalTTC = 0;
    const calculatedItems = items.map((item) => {
      const vatRate = item.vatRate ?? 19;
      const itemTotalHT = item.price * item.quantity;
      const itemVatAmount = itemTotalHT * (vatRate / 100);
      const itemTotalTTC = itemTotalHT + itemVatAmount;
      totalHT += itemTotalHT;
      totalTTC += itemTotalTTC;
      return { ...item, vatRate, vatAmount: itemVatAmount };
    });

    totalHT = dto.totalHT ?? totalHT;
    totalTTC = dto.totalTTC ?? totalTTC;

    return this.prisma.$transaction(async (prisma) => {
      const refund = await prisma.saleInvoice.create({
        data: {
          ...invoiceData,
          /* date: new Date(invoiceData.date), */
          date: new Date(),
          totalHT,
          totalTTC,
          clientId: 1,
          type: SaleInvoiceType.SALE_REFUND,
          status: InvoiceStatus.DRAFT,
          originalInvoiceId,
          items: { create: calculatedItems },
        },
        include: { client: true, items: true },
      });

      // Increment stock for refunded products
      for (const item of calculatedItems) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      return refund;
    });
  }

  /** UPDATE REFUND */
  async update(id: number, dto: UpdateRefundInvoiceDto) {
    const existing = await this.prisma.saleInvoice.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) throw new NotFoundException('Refund invoice not found');

    const { items, date, invoiceNumber, pdfUrl } = dto;

    let itemsUpdate: any = undefined;

    if (items) {
      // Restore old stock
      for (const oldItem of existing.items) {
        await this.prisma.product.update({
          where: { id: oldItem.productId },
          data: { stock: { increment: oldItem.quantity } },
        });
      }

      // Calculate new totals
      let totalHT = 0,
        totalTTC = 0;
      const calculatedItems: SaleRefundItemDto[] = items.map((item) => {
        const vatRate = item.vatRate ?? 19;
        const itemTotalHT = item.price * item.quantity;
        const itemVatAmount = itemTotalHT * (vatRate / 100);
        const itemTotalTTC = itemTotalHT + itemVatAmount;
        totalHT += itemTotalHT;
        totalTTC += itemTotalTTC;
        return { ...item, vatRate, vatAmount: itemVatAmount };
      });

      itemsUpdate = { deleteMany: {}, create: calculatedItems };

      // Decrement stock for new items
      for (const newItem of calculatedItems) {
        await this.prisma.product.update({
          where: { id: newItem.productId },
          data: { stock: { decrement: newItem.quantity } },
        });
      }

      dto.totalHT = dto.totalHT ?? totalHT;
      dto.totalTTC = dto.totalTTC ?? totalTTC;
    }

    return this.prisma.saleInvoice.update({
      where: { id },
      data: {
        invoiceNumber,
        date: date ? new Date(date) : undefined,
        totalHT: dto.totalHT,
        totalTTC: dto.totalTTC,
        items: itemsUpdate,
      },
      include: { items: true, client: true },
    });
  }

  /** GET REFUND BY ID */
  async findOne(id: number) {
    const refund = await this.prisma.saleInvoice.findFirst({
      where: { id },
      include: { client: true, items: true, originalInvoice: true },
    });
    if (!refund) throw new NotFoundException('Refund invoice not found');
    return refund;
  }
}
