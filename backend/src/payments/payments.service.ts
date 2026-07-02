// src/payments/payments.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentMethod, InvoiceStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPaymentDto: CreatePaymentDto) {
    // Validate that payment is linked to either purchase or sale, not both
    if (createPaymentDto.purchaseInvoiceId && createPaymentDto.saleInvoiceId) {
      throw new BadRequestException(
        'Payment cannot be linked to both purchase and sale invoice simultaneously.',
      );
    }

    // Validate that corresponding entity is provided
    if (createPaymentDto.purchaseInvoiceId && !createPaymentDto.supplierId) {
      throw new BadRequestException(
        'Supplier ID is required for purchase invoice payments.',
      );
    }

    if (createPaymentDto.saleInvoiceId && !createPaymentDto.clientId) {
      throw new BadRequestException(
        'Client ID is required for sale invoice payments.',
      );
    }

    // Use transaction to ensure data consistency
    return await this.prisma.$transaction(async (prisma) => {
      let invoice;
      let totalPaid: number = 0; // Initialize with default value
      let invoiceType: 'purchase' | 'sale' | null = null;

      // Validate purchase invoice
      if (createPaymentDto.purchaseInvoiceId) {
        invoiceType = 'purchase';
        invoice = await prisma.purchaseInvoice.findUnique({
          where: { id: createPaymentDto.purchaseInvoiceId },
          include: { supplier: true },
        });

        if (!invoice) {
          throw new NotFoundException(
            `Purchase invoice with id ${createPaymentDto.purchaseInvoiceId} not found.`,
          );
        }

        if (invoice.supplierId !== createPaymentDto.supplierId) {
          throw new BadRequestException(
            'Supplier does not match the purchase invoice supplier.',
          );
        }

        // Calculate total paid for this invoice
        totalPaid = await this.getInvoiceTotalPaid(
          prisma,
          'purchase',
          createPaymentDto.purchaseInvoiceId,
        );
      }

      // Validate sale invoice
      if (createPaymentDto.saleInvoiceId) {
        invoiceType = 'sale';
        invoice = await prisma.saleInvoice.findUnique({
          where: { id: createPaymentDto.saleInvoiceId },
          include: { client: true },
        });

        if (!invoice) {
          throw new NotFoundException(
            `Sale invoice with id ${createPaymentDto.saleInvoiceId} not found.`,
          );
        }

        if (invoice.clientId !== createPaymentDto.clientId) {
          throw new BadRequestException(
            'Client does not match the sale invoice client.',
          );
        }

        // Calculate total paid for this invoice
        totalPaid = await this.getInvoiceTotalPaid(
          prisma,
          'sale',
          createPaymentDto.saleInvoiceId,
        );
      }

      // Validate payment amount doesn't exceed remaining balance
      if (invoice && totalPaid + createPaymentDto.amount > invoice.totalTTC) {
        throw new BadRequestException(
          `Payment amount exceeds the remaining balance. Maximum allowed: ${invoice.totalTTC - totalPaid}`,
        );
      }

      // Create the payment
      const payment = await prisma.payment.create({
        data: {
          ...createPaymentDto,
          createdAt: new Date(),
        },
      });

      // Check and update invoice status based on new total paid
      if (invoice && invoiceType) {
        const newTotalPaid = totalPaid + createPaymentDto.amount;

        if (invoiceType === 'purchase' && createPaymentDto.purchaseInvoiceId) {
          await this.updatePurchaseInvoiceStatus(
            prisma,
            createPaymentDto.purchaseInvoiceId,
            invoice,
            newTotalPaid,
          );
        }

        if (invoiceType === 'sale' && createPaymentDto.saleInvoiceId) {
          await this.updateSaleInvoiceStatus(
            prisma,
            createPaymentDto.saleInvoiceId,
            invoice,
            newTotalPaid,
          );
        }
      }

      return payment;
    });
  }

  async update(id: number, updatePaymentDto: UpdatePaymentDto) {
    // Check if payment exists and get its details
    const existingPayment = await this.findOne(id);

    // Prevent changing invoice links
    if (
      updatePaymentDto.purchaseInvoiceId ||
      updatePaymentDto.saleInvoiceId ||
      updatePaymentDto.supplierId ||
      updatePaymentDto.clientId
    ) {
      throw new BadRequestException(
        'Cannot change invoice or entity associations. Create a new payment instead.',
      );
    }

    // Use transaction to ensure data consistency
    return await this.prisma.$transaction(async (prisma) => {
      // Store old amount for comparison
      const oldAmount = existingPayment.amount;
      const newAmount = updatePaymentDto.amount ?? oldAmount;
      const amountDiff = newAmount - oldAmount;

      // Update the payment
      const updatedPayment = await prisma.payment.update({
        where: { id },
        data: updatePaymentDto,
      });

      // If amount changed, update invoice status
      if (amountDiff !== 0) {
        // Update purchase invoice if applicable
        if (existingPayment.purchaseInvoiceId) {
          const invoice = await prisma.purchaseInvoice.findUnique({
            where: { id: existingPayment.purchaseInvoiceId },
          });

          if (invoice) {
            const totalPaid = await this.getInvoiceTotalPaid(
              prisma,
              'purchase',
              existingPayment.purchaseInvoiceId,
            );

            await this.updatePurchaseInvoiceStatus(
              prisma,
              existingPayment.purchaseInvoiceId,
              invoice,
              totalPaid,
            );
          }
        }

        // Update sale invoice if applicable
        if (existingPayment.saleInvoiceId) {
          const invoice = await prisma.saleInvoice.findUnique({
            where: { id: existingPayment.saleInvoiceId },
          });

          if (invoice) {
            const totalPaid = await this.getInvoiceTotalPaid(
              prisma,
              'sale',
              existingPayment.saleInvoiceId,
            );

            await this.updateSaleInvoiceStatus(
              prisma,
              existingPayment.saleInvoiceId,
              invoice,
              totalPaid,
            );
          }
        }
      }

      return updatedPayment;
    });
  }

  async remove(id: number) {
    // Check if payment exists and get its details
    const payment = await this.findOne(id);

    // Check if payment is older than 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    if (payment.createdAt < twentyFourHoursAgo) {
      throw new BadRequestException(
        'Cannot delete payments older than 24 hours.',
      );
    }

    // Use transaction to ensure data consistency
    return await this.prisma.$transaction(async (prisma) => {
      // Delete the payment
      await prisma.payment.delete({
        where: { id },
      });

      // Check and update invoice status after deletion
      if (payment.purchaseInvoiceId) {
        const invoice = await prisma.purchaseInvoice.findUnique({
          where: { id: payment.purchaseInvoiceId },
        });

        if (invoice) {
          const totalPaid = await this.getInvoiceTotalPaid(
            prisma,
            'purchase',
            payment.purchaseInvoiceId,
          );

          await this.updatePurchaseInvoiceStatus(
            prisma,
            payment.purchaseInvoiceId,
            invoice,
            totalPaid,
          );
        }
      }

      if (payment.saleInvoiceId) {
        const invoice = await prisma.saleInvoice.findUnique({
          where: { id: payment.saleInvoiceId },
        });

        if (invoice) {
          const totalPaid = await this.getInvoiceTotalPaid(
            prisma,
            'sale',
            payment.saleInvoiceId,
          );

          await this.updateSaleInvoiceStatus(
            prisma,
            payment.saleInvoiceId,
            invoice,
            totalPaid,
          );
        }
      }

      return { message: 'Payment deleted successfully', id };
    });
  }

  // Helper method to update purchase invoice status
  private async updatePurchaseInvoiceStatus(
    prisma: any,
    invoiceId: number,
    invoice: any,
    totalPaid: number,
  ) {
    let newStatus = invoice.status;

    if (totalPaid >= invoice.totalTTC) {
      newStatus = InvoiceStatus.PAID;
    } else if (
      invoice.status === InvoiceStatus.PAID &&
      totalPaid < invoice.totalTTC
    ) {
      newStatus = InvoiceStatus.VALIDATED;
    }

    if (newStatus !== invoice.status) {
      await prisma.purchaseInvoice.update({
        where: { id: invoiceId },
        data: { status: newStatus },
      });
      console.log(
        `Purchase invoice ${invoice.invoiceNumber} status updated from ${invoice.status} to ${newStatus}`,
      );
    }
  }

  // Helper method to update sale invoice status
  private async updateSaleInvoiceStatus(
    prisma: any,
    invoiceId: number,
    invoice: any,
    totalPaid: number,
  ) {
    let newStatus = invoice.status;

    if (totalPaid >= invoice.totalTTC) {
      newStatus = InvoiceStatus.PAID;
    } else if (
      invoice.status === InvoiceStatus.PAID &&
      totalPaid < invoice.totalTTC
    ) {
      newStatus = InvoiceStatus.VALIDATED;
    }

    if (newStatus !== invoice.status) {
      await prisma.saleInvoice.update({
        where: { id: invoiceId },
        data: { status: newStatus },
      });
      console.log(
        `Sale invoice ${invoice.invoiceNumber} status updated from ${invoice.status} to ${newStatus}`,
      );
    }
  }

  async findAll(type?: 'purchase' | 'sale' | 'all', entityId?: string) {
    const where: any = {};

    if (type === 'purchase') {
      where.purchaseInvoiceId = { not: null };
    } else if (type === 'sale') {
      where.saleInvoiceId = { not: null };
    }

    if (entityId) {
      const id = parseInt(entityId);
      where.OR = [
        { purchaseInvoiceId: id },
        { saleInvoiceId: id },
        { supplierId: id },
        { clientId: id },
      ];
    }

    return await this.prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        purchaseInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalTTC: true,
            status: true,
          },
        },
        saleInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalTTC: true,
            status: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        purchaseInvoice: true,
        saleInvoice: true,
        supplier: true,
        client: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with id ${id} not found.`);
    }

    return payment;
  }

  async findBySupplier(supplierId: number) {
    return await this.prisma.payment.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
      include: {
        purchaseInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalTTC: true,
            status: true,
          },
        },
      },
    });
  }

  async findByClient(clientId: number) {
    return await this.prisma.payment.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: {
        saleInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalTTC: true,
            status: true,
          },
        },
      },
    });
  }

  async findByPurchaseInvoice(purchaseInvoiceId: number) {
    const payments = await this.prisma.payment.findMany({
      where: { purchaseInvoiceId },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const invoice = await this.prisma.purchaseInvoice.findUnique({
      where: { id: purchaseInvoiceId },
      select: {
        totalTTC: true,
        status: true,
        invoiceNumber: true,
      },
    });

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      invoice,
      payments,
      summary: {
        totalPaid,
        totalTTC: invoice?.totalTTC || 0,
        remainingAmount: (invoice?.totalTTC || 0) - totalPaid,
        isFullyPaid: invoice ? totalPaid >= invoice.totalTTC : false,
      },
    };
  }

  async findBySaleInvoice(saleInvoiceId: number) {
    const payments = await this.prisma.payment.findMany({
      where: { saleInvoiceId },
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const invoice = await this.prisma.saleInvoice.findUnique({
      where: { id: saleInvoiceId },
      select: {
        totalTTC: true,
        status: true,
        invoiceNumber: true,
      },
    });

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      invoice,
      payments,
      summary: {
        totalPaid,
        totalTTC: invoice?.totalTTC || 0,
        remainingAmount: (invoice?.totalTTC || 0) - totalPaid,
        isFullyPaid: invoice ? totalPaid >= invoice.totalTTC : false,
      },
    };
  }

  async getTodaySummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const payments = await this.prisma.payment.findMany({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        purchaseInvoice: true,
        saleInvoice: true,
      },
    });

    const purchasePayments = payments.filter((p) => p.purchaseInvoiceId);
    const salePayments = payments.filter((p) => p.saleInvoiceId);

    const totalPurchase = purchasePayments.reduce(
      (sum, p) => sum + p.amount,
      0,
    );
    const totalSale = salePayments.reduce((sum, p) => sum + p.amount, 0);

    return {
      totalPurchase,
      totalSale,
      netFlow: totalSale - totalPurchase,
      count: payments.length,
      byMethod: payments.reduce(
        (acc, p) => {
          acc[p.method] = (acc[p.method] || 0) + p.amount;
          return acc;
        },
        {} as Record<PaymentMethod, number>,
      ),
    };
  }

  private async getInvoiceTotalPaid(
    prisma: any,
    type: 'purchase' | 'sale',
    invoiceId: number,
  ): Promise<number> {
    const where =
      type === 'purchase'
        ? { purchaseInvoiceId: invoiceId }
        : { saleInvoiceId: invoiceId };

    const payments = await prisma.payment.findMany({
      where,
      select: { amount: true },
    });

    return payments.reduce((sum: number, p: any) => sum + p.amount, 0);
  }

  async getBulkPaymentStatus(invoiceIds: number[], type: 'purchase' | 'sale') {
    const where =
      type === 'purchase'
        ? { purchaseInvoiceId: { in: invoiceIds } }
        : { saleInvoiceId: { in: invoiceIds } };

    const payments = await this.prisma.payment.findMany({
      where,
      select: {
        amount: true,
        purchaseInvoiceId: true,
        saleInvoiceId: true,
      },
    });

    // Get invoices to know their totals
    let invoices;
    if (type === 'purchase') {
      invoices = await this.prisma.purchaseInvoice.findMany({
        where: { id: { in: invoiceIds } },
        select: { id: true, totalTTC: true },
      });
    } else {
      invoices = await this.prisma.saleInvoice.findMany({
        where: { id: { in: invoiceIds } },
        select: { id: true, totalTTC: true },
      });
    }

    const invoiceMap = new Map(invoices.map((i) => [i.id, i.totalTTC]));
    const summary: Record<
      number,
      { totalPaid: number; remainingAmount: number; isFullyPaid: boolean }
    > = {};

    invoiceIds.forEach((id) => {
      const invoicePayments = payments.filter((p) =>
        type === 'purchase'
          ? p.purchaseInvoiceId === id
          : p.saleInvoiceId === id,
      );
      const totalPaid = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
      const totalTTC = invoiceMap.get(id) || 0;

      summary[id] = {
        totalPaid,
        remainingAmount: totalTTC - totalPaid,
        isFullyPaid: totalPaid >= totalTTC,
      };
    });

    return summary;
  }
}
