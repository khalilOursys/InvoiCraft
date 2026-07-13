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
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private validatePaymentMethodFields(dto: CreatePaymentDto | any) {
    // Validate CHECK method fields
    if (dto.method === PaymentMethod.CHECK) {
      if (!dto.checkDate) {
        throw new BadRequestException('La date du chèque est requise.');
      }
      if (!dto.checkBank) {
        throw new BadRequestException('La banque est requise.');
      }
      if (!dto.checkNumber) {
        throw new BadRequestException('Le numéro de chèque est requis.');
      }
      // Clean up other method fields
      dto.traitDate = undefined;
      dto.traitNumber = undefined;
    }

    // Validate TRAIT method fields
    if (dto.method === PaymentMethod.TRAIT) {
      if (!dto.traitDate) {
        throw new BadRequestException('La date du trait est requise.');
      }
      if (!dto.traitNumber) {
        throw new BadRequestException('Le numéro du trait est requis.');
      }
      // Clean up other method fields
      dto.checkDate = undefined;
      dto.checkBank = undefined;
      dto.checkNumber = undefined;
    }

    // Clean up method-specific fields for other methods
    if (
      dto.method !== PaymentMethod.CHECK &&
      dto.method !== PaymentMethod.TRAIT
    ) {
      dto.checkDate = undefined;
      dto.checkBank = undefined;
      dto.checkNumber = undefined;
      dto.traitDate = undefined;
      dto.traitNumber = undefined;
    }
  }

  private validateFile(file: any) {
    if (!file) return null;

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size && file.size > maxSize) {
      throw new BadRequestException(
        'Le fichier est trop volumineux (max 5MB).',
      );
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/pdf',
    ];
    if (file.mimetype && !allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Format de fichier non supporté. Utilisez JPG, PNG ou PDF.',
      );
    }

    return file;
  }

  private async saveFile(
    file: any,
  ): Promise<{ path: string | null; name: string | null }> {
    if (!file) return { path: null, name: null };

    // Validate file
    this.validateFile(file);

    // Create uploads directory if it doesn't exist
    const uploadDir = './uploads/payments';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = path.extname(file.originalname || '');
    const filename = `payment_${timestamp}_${Math.random().toString(36).substring(7)}${extension}`;
    const filePath = path.join(uploadDir, filename);

    // Save file
    if (file.buffer) {
      fs.writeFileSync(filePath, file.buffer);
    } else if (file.path) {
      fs.copyFileSync(file.path, filePath);
    }

    return {
      path: `/uploads/payments/${filename}`,
      name: file.originalname || filename,
    };
  }

  private async deleteFile(filePath: string | null) {
    if (!filePath) return;

    try {
      const fullPath = path.join(process.cwd(), filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }

  async create(createPaymentDto: CreatePaymentDto, file?: any) {
    // Validate payment method specific fields
    this.validatePaymentMethodFields(createPaymentDto);

    // Validate that payment is linked to either purchase or sale, not both
    if (createPaymentDto.purchaseInvoiceId && createPaymentDto.saleInvoiceId) {
      throw new BadRequestException(
        "Le paiement ne peut pas être lié à une facture d'achat et une facture de vente simultanément.",
      );
    }

    // Validate that corresponding entity is provided
    if (createPaymentDto.purchaseInvoiceId && !createPaymentDto.supplierId) {
      throw new BadRequestException(
        "L'ID du fournisseur est requis pour les paiements de facture d'achat.",
      );
    }

    if (createPaymentDto.saleInvoiceId && !createPaymentDto.clientId) {
      throw new BadRequestException(
        "L'ID du client est requis pour les paiements de facture de vente.",
      );
    }

    // Handle file upload
    let fileData = { path: null, name: null } as {
      path: string | null;
      name: string | null;
    };
    if (file) {
      fileData = await this.saveFile(file);
    }

    // Use transaction to ensure data consistency
    return await this.prisma.$transaction(async (prisma) => {
      let invoice;
      let totalPaid: number = 0;
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
            `Facture d'achat avec l'ID ${createPaymentDto.purchaseInvoiceId} non trouvée.`,
          );
        }

        if (invoice.supplierId !== createPaymentDto.supplierId) {
          throw new BadRequestException(
            "Le fournisseur ne correspond pas à la facture d'achat.",
          );
        }

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
            `Facture de vente avec l'ID ${createPaymentDto.saleInvoiceId} non trouvée.`,
          );
        }

        if (invoice.clientId !== createPaymentDto.clientId) {
          throw new BadRequestException(
            'Le client ne correspond pas à la facture de vente.',
          );
        }

        totalPaid = await this.getInvoiceTotalPaid(
          prisma,
          'sale',
          createPaymentDto.saleInvoiceId,
        );
      }

      // Validate payment amount doesn't exceed remaining balance
      if (invoice && totalPaid + createPaymentDto.amount > invoice.totalTTC) {
        throw new BadRequestException(
          `Le montant du paiement dépasse le solde restant. Maximum autorisé: ${(invoice.totalTTC - totalPaid).toFixed(2)}`,
        );
      }

      // Create the payment with file data
      const payment = await prisma.payment.create({
        data: {
          amount: createPaymentDto.amount,
          method: createPaymentDto.method,
          checkDate: createPaymentDto.checkDate
            ? new Date(createPaymentDto.checkDate)
            : undefined,
          checkBank: createPaymentDto.checkBank,
          checkNumber: createPaymentDto.checkNumber,
          traitDate: createPaymentDto.traitDate
            ? new Date(createPaymentDto.traitDate)
            : undefined,
          traitNumber: createPaymentDto.traitNumber,
          receiptFile: fileData.path,
          receiptFileName: fileData.name,
          purchaseInvoiceId: createPaymentDto.purchaseInvoiceId,
          supplierId: createPaymentDto.supplierId,
          saleInvoiceId: createPaymentDto.saleInvoiceId,
          clientId: createPaymentDto.clientId,
          createdAt: createPaymentDto.createdAt
            ? new Date(createPaymentDto.createdAt)
            : new Date(),
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

  async update(id: number, updatePaymentDto: UpdatePaymentDto, file?: any) {
    // Check if payment exists and get its details
    const existingPayment = await this.findOne(id);

    console.log('eeee', updatePaymentDto);
    // Prevent changing invoice links
    /* if (
      updatePaymentDto.purchaseInvoiceId ||
      updatePaymentDto.saleInvoiceId ||
      updatePaymentDto.supplierId ||
      updatePaymentDto.clientId
    ) {
      throw new BadRequestException(
        "Impossible de modifier les associations de facture ou d'entité. Créez un nouveau paiement à la place.",
      );
    } */

    // Validate payment method specific fields if method is being changed
    if (updatePaymentDto.method) {
      const tempDto = { ...existingPayment, ...updatePaymentDto };
      this.validatePaymentMethodFields(tempDto);
    }

    // Handle file upload - delete old file if new file is provided
    let fileData = { path: null, name: null } as {
      path: string | null;
      name: string | null;
    };
    let shouldDeleteOldFile = false;

    if (file) {
      fileData = await this.saveFile(file);
      shouldDeleteOldFile = true;
    } else if (updatePaymentDto.receiptFile === null) {
      // If explicitly set to null, delete the file
      shouldDeleteOldFile = true;
    }

    // Use transaction to ensure data consistency
    return await this.prisma.$transaction(async (prisma) => {
      // Store old amount for comparison
      const oldAmount = existingPayment.amount;
      const newAmount = updatePaymentDto.amount ?? oldAmount;
      const amountDiff = newAmount - oldAmount;

      // Delete old file if needed
      if (shouldDeleteOldFile && existingPayment.receiptFile) {
        await this.deleteFile(existingPayment.receiptFile);
      }

      // Build update data
      const updateData: any = {
        amount: updatePaymentDto.amount,
        method: updatePaymentDto.method,
        checkDate: updatePaymentDto.checkDate
          ? new Date(updatePaymentDto.checkDate)
          : undefined,
        checkBank: updatePaymentDto.checkBank,
        checkNumber: updatePaymentDto.checkNumber,
        traitDate: updatePaymentDto.traitDate
          ? new Date(updatePaymentDto.traitDate)
          : undefined,
        traitNumber: updatePaymentDto.traitNumber,
      };

      // Only update file fields if file was uploaded or explicitly set to null
      if (file) {
        updateData.receiptFile = fileData.path;
        updateData.receiptFileName = fileData.name;
      } else if (updatePaymentDto.receiptFile === null) {
        updateData.receiptFile = null;
        updateData.receiptFileName = null;
      }

      // Update the payment
      const updatedPayment = await prisma.payment.update({
        where: { id },
        data: updateData,
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
        'Impossible de supprimer les paiements de plus de 24 heures.',
      );
    }

    // Use transaction to ensure data consistency
    return await this.prisma.$transaction(async (prisma) => {
      // Delete the payment
      await prisma.payment.delete({
        where: { id },
      });

      // Delete associated file
      if (payment.receiptFile) {
        await this.deleteFile(payment.receiptFile);
      }

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

      return { message: 'Paiement supprimé avec succès', id };
    });
  }

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
    }
  }

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
      throw new NotFoundException(`Paiement avec l'ID ${id} non trouvé.`);
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
