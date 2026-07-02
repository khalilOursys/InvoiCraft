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
import { InvoiceStatus, PurchaseInvoiceType } from '@prisma/client';
import { UpdateStatusDto } from './dto/update-status.dto';

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
}
