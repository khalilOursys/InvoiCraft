// src/purchase-invoice/purchase-invoice.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { UpdatePurchaseInvoiceDto } from './dto/update-purchase-invoice.dto';
import { FilterPurchaseInvoiceDto } from './dto/filter-purchase-invoice.dto';
import { InvoiceStatus, Prisma, PurchaseInvoiceType } from '@prisma/client';
import { UpdateStatusDto } from './dto/update-status.dto';
type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';
@Injectable()
export class PurchaseInvoiceService {
  constructor(private prisma: PrismaService) {}

  async create(createPurchaseInvoiceDto: CreatePurchaseInvoiceDto) {
    const { items, supplierId, ...invoiceData } = createPurchaseInvoiceDto;

    // Check if supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    // Check if invoice number already exists
    const existingInvoice = await this.prisma.purchaseInvoice.findFirst({
      where: { invoiceNumber: invoiceData.invoiceNumber },
    });

    if (existingInvoice) {
      throw new BadRequestException('Invoice number already exists');
    }

    // Check if all products exist
    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(
          `Product with ID ${item.productId} not found`,
        );
      }
    }

    // Calculate totals if not provided
    let totalHT = createPurchaseInvoiceDto.totalHT;
    let totalTTC = createPurchaseInvoiceDto.totalTTC;

    if (!totalHT || !totalTTC) {
      totalHT = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      totalTTC = totalHT * 1.19; // 19% VAT
    }

    // Create invoice with items in a transaction
    return this.prisma.$transaction(async (prisma) => {
      const invoice = await prisma.purchaseInvoice.create({
        data: {
          ...invoiceData,
          date: new Date(invoiceData.date),
          totalHT,
          totalTTC,
          supplierId,
          type: invoiceData.type ?? PurchaseInvoiceType.PURCHASE_INVOICE, // FIX
          status: invoiceData.status ?? InvoiceStatus.DRAFT, // FIX
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Update product stock (if your products have stock management)
      for (const item of items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }

      return invoice;
    });
  }

  async findAll(filterDto?: FilterPurchaseInvoiceDto) {
    const where: any = {};

    if (filterDto) {
      if (filterDto.startDate || filterDto.endDate) {
        where.date = {};
        if (filterDto.startDate) {
          where.date.gte = new Date(filterDto.startDate);
        }
        if (filterDto.endDate) {
          where.date.lte = new Date(filterDto.endDate);
        }
      }

      if (filterDto.status) {
        where.status = filterDto.status;
      }

      if (filterDto.type) {
        where.type = filterDto.type;
      }

      if (filterDto.invoiceNumber) {
        where.invoiceNumber = {
          contains: filterDto.invoiceNumber,
          mode: 'insensitive',
        };
      }

      if (filterDto.supplierName && filterDto.supplierId) {
        where.supplier = {
          AND: [
            {
              name: {
                contains: filterDto.supplierName,
                mode: 'insensitive',
              },
            },
            {
              id: filterDto.supplierId,
            },
          ],
        };
      } else if (filterDto.supplierName) {
        where.supplier = {
          name: {
            contains: filterDto.supplierName,
            mode: 'insensitive',
          },
        };
      } else if (filterDto.supplierId) {
        where.supplier = {
          id: filterDto.supplierId,
        };
      }
    }

    return this.prisma.purchaseInvoice.findMany({
      where,
      include: {
        payments: true,
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const invoice = await this.prisma.purchaseInvoice.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Purchase invoice with ID ${id} not found`);
    }

    return invoice;
  }

  async findByInvoiceNumber(invoiceNumber: string) {
    const invoice = await this.prisma.purchaseInvoice.findFirst({
      where: { invoiceNumber },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(
        `Purchase invoice with number ${invoiceNumber} not found`,
      );
    }

    return invoice;
  }

  async findBySupplier(supplierId: number) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    return this.prisma.purchaseInvoice.findMany({
      where: { supplierId },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(id: number, updatePurchaseInvoiceDto: UpdatePurchaseInvoiceDto) {
    // Check if invoice exists
    const existingInvoice = await this.findOne(id);

    const { items, supplierId, ...updateData } = updatePurchaseInvoiceDto;

    // If supplierId is being updated, check if new supplier exists
    if (supplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier) {
        throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
      }
    }

    // If invoice number is being updated, check if it's unique
    if (
      updateData.invoiceNumber &&
      updateData.invoiceNumber !== existingInvoice.invoiceNumber
    ) {
      const invoiceWithSameNumber = await this.prisma.purchaseInvoice.findFirst(
        {
          where: { invoiceNumber: updateData.invoiceNumber },
        },
      );

      if (invoiceWithSameNumber) {
        throw new BadRequestException('Invoice number already exists');
      }
    }

    // Handle items update
    let itemsUpdate: any = undefined;
    if (items) {
      // Check if all products exist
      for (const item of items) {
        if (item.productId) {
          const product = await this.prisma.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new NotFoundException(
              `Product with ID ${item.productId} not found`,
            );
          }
        }
      }

      // Delete existing items and create new ones
      itemsUpdate = {
        deleteMany: {},
        create: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
      };

      // Update totals based on new items
      const newTotalHT = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      updateData.totalHT = newTotalHT;
      updateData.totalTTC = newTotalHT * 1.19;
    }

    // Convert date string to Date object if provided
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    return this.prisma.purchaseInvoice.update({
      where: { id },
      data: {
        ...updateData,
        supplierId,
        items: itemsUpdate,
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async updateStatus(id: number, updateStatusDto: UpdateStatusDto) {
    await this.findOne(id); // Check if invoice exists

    return this.prisma.purchaseInvoice.update({
      where: { id },
      data: {
        status: updateStatusDto.status,
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Check if invoice exists

    return this.prisma.$transaction(async (prisma) => {
      // First, delete all items
      await prisma.purchaseInvoiceItem.deleteMany({
        where: { invoiceId: id },
      });

      // Then delete the invoice
      return prisma.purchaseInvoice.delete({
        where: { id },
      });
    });
  }

  async uploadPdf(id: number, pdfUrl: string) {
    await this.findOne(id); // Check if invoice exists

    return this.prisma.purchaseInvoice.update({
      where: { id },
      data: { pdfUrl },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async getStatistics() {
    const totalInvoices = await this.prisma.purchaseInvoice.count();
    const totalAmount = await this.prisma.purchaseInvoice.aggregate({
      _sum: {
        totalTTC: true,
      },
    });
    const draftInvoices = await this.prisma.purchaseInvoice.count({
      where: { status: 'DRAFT' },
    });
    const paidInvoices = await this.prisma.purchaseInvoice.count({
      where: { status: 'PAID' },
    });

    const monthlyStats = await this.prisma.purchaseInvoice.groupBy({
      by: ['date'],
      _sum: {
        totalTTC: true,
      },
      where: {
        date: {
          gte: new Date(
            new Date().getFullYear(),
            new Date().getMonth() - 11,
            1,
          ),
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return {
      totalInvoices,
      totalAmount: totalAmount._sum.totalTTC || 0,
      draftInvoices,
      paidInvoices,
      monthlyStats,
    };
  }

  // ==================== PAYMENT CALCULATION METHODS ====================

  /**
   * Calculate payments for a single purchase invoice
   */
  async calculateInvoicePayments(invoiceId: number) {
    const invoice = await this.prisma.purchaseInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        payments: true,
        items: {
          include: {
            product: true,
          },
        },
        supplier: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(
        `Purchase invoice with ID ${invoiceId} not found`,
      );
    }

    const totalPaid = invoice.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );
    const totalInvoiceAmount = invoice.totalTTC || invoice.totalHT || 0;
    const remainingAmount = totalInvoiceAmount - totalPaid;
    const paidPercentage =
      totalInvoiceAmount > 0 ? (totalPaid / totalInvoiceAmount) * 100 : 0;
    const paymentStatus = this.getPaymentStatus(totalPaid, totalInvoiceAmount);

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalInvoiceAmount,
      totalPaid,
      remainingAmount,
      paidPercentage: Math.round(paidPercentage * 100) / 100,
      paymentStatus,
      statusLabel: this.getPaymentStatusLabel(paymentStatus),
      progressWidth: Math.min(paidPercentage, 100),
      paymentCount: invoice.payments.length,
      payments: invoice.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        createdAt: p.createdAt,
      })),
      supplier: invoice.supplier,
      items: invoice.items,
    };
  }

  /**
   * Get all purchase invoices for a supplier with payment calculations
   */
  async getSupplierInvoicesWithPayments(supplierId: number) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: { supplierId },
      include: {
        payments: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // Transform to simplified format
    const simplifiedInvoices = invoices.map((invoice) => {
      const totalPaid = invoice.payments.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      const totalAmount = invoice.totalTTC || invoice.totalHT || 0;
      const remainingAmount = totalAmount - totalPaid;
      const paidPercentage =
        totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;
      const status = this.getPaymentStatus(totalPaid, totalAmount);

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        type: invoice.type,
        status: invoice.status,
        totalHT: invoice.totalHT,
        totalTTC: invoice.totalTTC,
        totalPaid: Math.round(totalPaid * 100) / 100,
        remainingAmount: Math.round(remainingAmount * 100) / 100,
        paidPercentage: Math.round(paidPercentage * 100) / 100,
        paymentStatus: status,
        statusLabel: this.getPaymentStatusLabel(status),
        paymentCount: invoice.payments.length,
        payments: invoice.payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          method: p.method,
          createdAt: p.createdAt,
        })),
        items: invoice.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.product.name,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price,
        })),
      };
    });

    return simplifiedInvoices;
  }
  /**
   * Get payment summary for all purchase invoices
   */
  async getAllPurchaseInvoicesPaymentSummary() {
    const invoices = await this.prisma.purchaseInvoice.findMany({
      include: {
        payments: true,
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    return invoices.map((invoice) => {
      const totalPaid = invoice.payments.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      const totalAmount = invoice.totalTTC || invoice.totalHT || 0;
      const remainingAmount = totalAmount - totalPaid;
      const paidPercentage =
        totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;
      const status = this.getPaymentStatus(totalPaid, totalAmount);

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        type: invoice.type,
        status: invoice.status,
        supplier: invoice.supplier,
        totalAmount,
        totalPaid,
        remainingAmount,
        paidPercentage: Math.round(paidPercentage * 100) / 100,
        paymentStatus: status,
        statusLabel: this.getPaymentStatusLabel(status),
        progressWidth: Math.min(paidPercentage, 100),
        paymentCount: invoice.payments.length,
        formattedTotal: `${totalAmount.toFixed(2)} TND`,
        formattedPaid: `${totalPaid.toFixed(2)} TND`,
        formattedRemaining: `${remainingAmount.toFixed(2)} TND`,
      };
    });
  }

  /**
   * Get supplier balance (total amount - total paid)
   */
  async getSupplierBalance(supplierId: number) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: { supplierId },
      include: {
        payments: true,
      },
    });

    let totalAmount = 0;
    let totalPaid = 0;

    invoices.forEach((invoice) => {
      const invoiceTotal = invoice.totalTTC || invoice.totalHT || 0;
      const invoicePaid = invoice.payments.reduce(
        (sum, p) => sum + p.amount,
        0,
      );

      totalAmount += invoiceTotal;
      totalPaid += invoicePaid;
    });

    const balance = totalAmount - totalPaid;

    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        code: supplier.code,
        phone: supplier.phone,
        email: supplier.email,
        taxNumber: supplier.taxNumber,
      },
      summary: {
        totalInvoices: invoices.length,
        totalAmount,
        totalPaid,
        balance,
        balanceStatus: balance > 0 ? 'DEBIT' : balance < 0 ? 'CREDIT' : 'ZERO',
        formattedBalance: `${Math.abs(balance).toFixed(2)} TND ${balance > 0 ? '(Debit)' : balance < 0 ? '(Credit)' : ''}`,
      },
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        total: invoice.totalTTC || invoice.totalHT || 0,
        paid: invoice.payments.reduce((sum, p) => sum + p.amount, 0),
        remaining:
          (invoice.totalTTC || invoice.totalHT || 0) -
          invoice.payments.reduce((sum, p) => sum + p.amount, 0),
        status: invoice.status,
        paymentCount: invoice.payments.length,
      })),
    };
  }

  /**
   * Get overdue purchase invoices (older than 30 days and not fully paid)
   */
  async getOverduePurchaseInvoices(supplierId?: number) {
    const where: Prisma.PurchaseInvoiceWhereInput = {
      status: {
        in: [InvoiceStatus.VALIDATED, InvoiceStatus.DRAFT],
      },
    };

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const invoices = await this.prisma.purchaseInvoice.findMany({
      where,
      include: {
        payments: true,
        supplier: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    const overdueInvoices = invoices
      .map((invoice) => {
        const totalPaid = invoice.payments.reduce(
          (sum, payment) => sum + payment.amount,
          0,
        );
        const totalAmount = invoice.totalTTC || invoice.totalHT || 0;
        const remainingAmount = totalAmount - totalPaid;
        const status = this.getPaymentStatus(totalPaid, totalAmount);

        const daysOverdue = this.calculateDaysOverdue(invoice.date);

        return {
          ...invoice,
          remainingAmount,
          paymentStatus: status,
          statusLabel: this.getPaymentStatusLabel(status),
          daysOverdue,
          isOverdue: daysOverdue > 30 && status !== 'PAID',
          formattedRemaining: `${remainingAmount.toFixed(2)} TND`,
        };
      })
      .filter(
        (inv) =>
          (inv.paymentStatus === 'PARTIAL' || inv.paymentStatus === 'UNPAID') &&
          inv.isOverdue,
      );

    return {
      totalOverdue: overdueInvoices.length,
      totalOverdueAmount: overdueInvoices.reduce(
        (sum, inv) => sum + inv.remainingAmount,
        0,
      ),
      invoices: overdueInvoices,
    };
  }

  /**
   * Bulk update payment status for multiple invoices
   */
  async updateBulkPaymentStatus(invoiceIds: number[]) {
    const results = [];

    for (const id of invoiceIds) {
      const paymentData = await this.calculateInvoicePayments(id);
      const status = paymentData.paymentStatus;

      let invoiceStatus: InvoiceStatus = InvoiceStatus.VALIDATED;
      if (status === 'PAID') {
        invoiceStatus = InvoiceStatus.PAID;
      }

      const updated = await this.prisma.purchaseInvoice.update({
        where: { id },
        data: { status: invoiceStatus },
      });

      results.push({
        invoiceId: id,
        invoiceNumber: updated.invoiceNumber,
        oldStatus: updated.status,
        newStatus: invoiceStatus,
        paymentStatus: status,
      });
    }

    return {
      processed: results.length,
      results,
    };
  }

  // ==================== HELPER METHODS ====================

  private getPaymentStatus(
    totalPaid: number,
    totalAmount: number,
  ): PaymentStatus {
    if (totalAmount === 0) return 'PAID';
    if (totalPaid >= totalAmount) return 'PAID';
    if (totalPaid > 0) return 'PARTIAL';
    return 'UNPAID';
  }

  private getPaymentStatusLabel(status: PaymentStatus): string {
    const labels = {
      PAID: '✅ Paid',
      PARTIAL: '⏳ Partial Payment',
      UNPAID: '❌ Unpaid',
    };
    return labels[status] || status;
  }

  private calculateDaysOverdue(date: Date): number {
    const today = new Date();
    const invoiceDate = new Date(date);
    const diffTime = today.getTime() - invoiceDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }
}
