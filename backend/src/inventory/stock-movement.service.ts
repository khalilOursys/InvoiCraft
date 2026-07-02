// src/inventory/stock-movement.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockMovementType, StockMovementStatus } from '@prisma/client';
import { UpdateStockMovementDto } from './dto/update-stock-movement.dto';

@Injectable()
export class StockMovementService {
  constructor(private readonly prisma: PrismaService) {}
  // NEW: Get all movements with filters
  async getAllMovements(filters: {
    page?: number;
    limit?: number;
    productId?: number;
    type?: StockMovementType;
    status?: StockMovementStatus;
    startDate?: Date;
    endDate?: Date;
  }) {
    const {
      page = 1,
      limit = 50,
      productId,
      type,
      status,
      startDate,
      endDate,
    } = filters;

    const where: any = {};

    if (productId) where.productId = productId;
    if (type) where.type = type;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              reference: true,
            },
          },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      movements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // NEW: Get single movement by ID
  async getMovementById(id: number) {
    const movement = await this.prisma.stockMovement.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
          },
        },
      },
    });

    if (!movement) {
      throw new NotFoundException(`Stock movement with id ${id} not found`);
    }

    return movement;
  }

  // NEW: Update movement
  async updateMovement(
    id: number,
    userId: number,
    dto: UpdateStockMovementDto,
  ) {
    const existingMovement = await this.getMovementById(id);

    const oldValues = {
      status: existingMovement.status,
      reason: existingMovement.reason,
      notes: existingMovement.notes,
    };

    const updateData: any = {};

    if (dto.status) updateData.status = dto.status;
    if (dto.reason) updateData.reason = dto.reason;
    if (dto.notes) updateData.notes = dto.notes;

    // Add metadata about update
    updateData.notes = updateData.notes
      ? `${updateData.notes}\n[Updated by user ${userId} on ${new Date().toISOString()}]`
      : `[Updated by user ${userId} on ${new Date().toISOString()}]`;

    const updatedMovement = await this.prisma.stockMovement.update({
      where: { id },
      data: updateData,
      include: {
        product: true,
      },
    });

    return {
      movement: updatedMovement,
      oldValues,
      newValues: {
        status: updatedMovement.status,
        reason: updatedMovement.reason,
        notes: updatedMovement.notes,
      },
    };
  }

  // NEW: Cancel movement
  async cancelMovement(id: number, userId: number, reason?: string) {
    const movement = await this.getMovementById(id);

    if (movement.status === StockMovementStatus.CANCELLED) {
      throw new BadRequestException('Movement is already cancelled');
    }

    // Reverse the stock effect
    await this.reverseMovement(id, userId);

    const cancelledMovement = await this.prisma.stockMovement.update({
      where: { id },
      data: {
        status: StockMovementStatus.CANCELLED,
        notes: movement.notes
          ? `${movement.notes}\n[CANCELLED on ${new Date().toISOString()} by user ${userId}: ${reason || 'No reason provided'}]`
          : `[CANCELLED on ${new Date().toISOString()} by user ${userId}: ${reason || 'No reason provided'}]`,
      },
    });

    return {
      message: 'Movement cancelled successfully',
      movement: cancelledMovement,
    };
  }

  // NEW: Reverse movement (helper method)
  private async reverseMovement(movementId: number, userId: number) {
    const movement = await this.getMovementById(movementId);
    const product = await this.prisma.product.findUnique({
      where: { id: movement.productId },
    });
    if (!product) {
      throw new NotFoundException(
        `Product with id ${movement.productId} not found`,
      );
    }
    const reverseQuantity = -movement.quantity;
    const newStock = product.stock + reverseQuantity;

    if (newStock < 0) {
      throw new BadRequestException(
        'Cannot cancel movement: would cause negative stock',
      );
    }

    // Create reverse movement record
    const reverseMovement = await this.prisma.stockMovement.create({
      data: {
        movementNumber: `REV-${movement.movementNumber}`,
        type: StockMovementType.ADJUSTMENT,
        quantity: reverseQuantity,
        previousStock: product.stock,
        newStock: newStock,
        reason: `Reverse of movement ${movement.movementNumber}`,
        reference: movement.movementNumber,
        status: StockMovementStatus.COMPLETED,
        productId: movement.productId,
        createdBy: userId,
        notes: `Auto-generated reversal for cancelled movement ${movementId}`,
      },
    });

    // Update product stock
    await this.prisma.product.update({
      where: { id: movement.productId },
      data: {
        stock: newStock,
        lastStockUpdate: new Date(),
      },
    });

    return reverseMovement;
  }

  // NEW: Get product movements with comparison
  async getProductMovementsWithComparison(
    productId: number,
    page: number = 1,
    limit: number = 50,
    type?: StockMovementType,
  ) {
    const where: any = { productId };
    if (type) where.type = type;

    const [movements, total, product] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockMovement.count({ where }),
      this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, reference: true, stock: true },
      }),
    ]);

    const summary = movements.reduce(
      (acc, movement) => {
        if (movement.quantity > 0) {
          acc.totalInbound += movement.quantity;
        } else {
          acc.totalOutbound += Math.abs(movement.quantity);
        }
        return acc;
      },
      { totalInbound: 0, totalOutbound: 0 },
    );

    return {
      product,
      currentStock: product?.stock,
      movements: movements.map((m) => ({
        ...m,
        stockAfter: m.newStock,
        stockBefore: m.previousStock,
        difference: m.newStock - m.previousStock,
      })),
      summary: {
        ...summary,
        netChange: summary.totalInbound - summary.totalOutbound,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // NEW: Global movement summary for dashboard
  async getMovementSummaryGlobal(startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const movements = await this.prisma.stockMovement.findMany({
      where,
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      totalMovements: movements.length,
      byType: {} as Record<StockMovementType, number>,
      byStatus: {} as Record<StockMovementStatus, number>,
      totalInboundValue: 0,
      totalOutboundValue: 0,
      recentMovements: movements.slice(0, 10),
    };

    movements.forEach((m) => {
      summary.byType[m.type] = (summary.byType[m.type] || 0) + 1;
      summary.byStatus[m.status] = (summary.byStatus[m.status] || 0) + 1;

      if (m.quantity > 0) {
        summary.totalInboundValue +=
          m.quantity * (m.product?.purchasePrice || 0);
      } else {
        summary.totalOutboundValue +=
          Math.abs(m.quantity) * (m.product?.salePrice || 0);
      }
    });

    return summary;
  }
  async createStockMovement(
    productId: number,
    userId: number,
    dto: CreateStockMovementDto,
    skipStockUpdate: boolean = false,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    const movementNumber = `MOV-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const previousStock = product.stock;
    let newStock = previousStock;

    let reason = dto.reason;

    if (!skipStockUpdate) {
      if (
        dto.type === StockMovementType.INBOUND ||
        dto.type === StockMovementType.INITIAL
      ) {
        newStock = previousStock + dto.quantity;

        if (!reason) {
          reason =
            dto.type === StockMovementType.INITIAL
              ? 'Initial stock setup'
              : 'Stock received';
        }
      } else if (
        dto.type === StockMovementType.OUTBOUND ||
        dto.type === StockMovementType.LOSS
      ) {
        newStock = previousStock - dto.quantity;

        if (newStock < 0) {
          throw new BadRequestException('Insufficient stock');
        }

        if (!reason) {
          reason =
            dto.type === StockMovementType.OUTBOUND
              ? 'Stock issued'
              : 'Lost, damaged or expired stock';
        }
      } else if (dto.type === StockMovementType.ADJUSTMENT) {
        newStock = dto.quantity;

        if (!reason) {
          reason = `Stock adjusted from ${previousStock} to ${dto.quantity}`;
        }
      } else if (dto.type === StockMovementType.RETURN) {
        newStock = previousStock + dto.quantity;

        if (!reason) {
          reason = 'Returned to inventory';
        }
      } else if (dto.type === StockMovementType.TRANSFER) {
        newStock = previousStock;

        if (!reason) {
          reason = 'Stock transferred';
        }
      }
    }

    const movement = await this.prisma.stockMovement.create({
      data: {
        movementNumber,
        type: dto.type,
        quantity:
          dto.type === StockMovementType.OUTBOUND ||
          dto.type === StockMovementType.LOSS
            ? -dto.quantity
            : dto.quantity,
        previousStock,
        newStock: skipStockUpdate ? previousStock : newStock,
        reason: reason,
        reference: dto.reference,
        status: dto.status || StockMovementStatus.COMPLETED,
        productId,
        purchaseInvoiceItemId: dto.purchaseInvoiceItemId,
        saleInvoiceItemId: dto.saleInvoiceItemId,
        orderItemId: dto.orderItemId,
        createdBy: userId,
        notes: dto.notes,
      },
    });

    // Update product stock if not skipped
    if (!skipStockUpdate && dto.type !== StockMovementType.TRANSFER) {
      await this.prisma.product.update({
        where: { id: productId },
        data: {
          stock: newStock,
          lastStockUpdate: new Date(),
          ...(dto.type === StockMovementType.PURCHASE && {
            lastPurchaseDate: new Date(),
          }),
          ...(dto.type === StockMovementType.SALE && {
            lastSaleDate: new Date(),
          }),
        },
      });
    }

    return movement;
  }

  async getProductMovements(
    productId: number,
    page: number = 1,
    limit: number = 50,
    type?: StockMovementType,
  ) {
    const where: any = { productId };
    if (type) where.type = type;

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      movements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMovementSummary(productId: number, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        productId,
        createdAt: { gte: startDate },
        status: StockMovementStatus.COMPLETED,
      },
    });

    const inbound = movements
      .filter(
        (m) =>
          m.type === StockMovementType.INBOUND ||
          m.type === StockMovementType.RETURN,
      )
      .reduce((sum, m) => sum + Math.abs(m.quantity), 0);

    const outbound = movements
      .filter(
        (m) =>
          m.type === StockMovementType.OUTBOUND ||
          m.type === StockMovementType.LOSS,
      )
      .reduce((sum, m) => sum + Math.abs(m.quantity), 0);

    const netChange = inbound - outbound;

    return {
      period: `${days} days`,
      inbound,
      outbound,
      netChange,
      averageDailyOutbound: outbound / days,
      estimatedDaysRemaining: outbound > 0 ? inbound / (outbound / days) : null,
    };
  }

  async getLastMovementForEachProduct() {
    // Get all active products with their latest stock movement
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Get only the most recent movement for each product
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            img: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transform the result to have a cleaner structure
    return products.map((product) => ({
      product: {
        id: product.id,
        name: product.name,
        reference: product.reference,
        internalCode: product.internalCode,
        description: product.description,
        currentStock: product.stock,
        minStock: product.minStock,
        criticalStock: product.criticalStock,
        reservedStock: product.reservedStock,
        purchasePrice: product.purchasePrice,
        salePrice: product.salePrice,
        priceIncludingTax: product.priceIncludingTax,
        category: product.category,
        brand: product.brand,
        isActive: product.isActive,
      },
      lastMovement: product.stockMovements[0]
        ? {
            id: product.stockMovements[0].id,
            movementNumber: product.stockMovements[0].movementNumber,
            type: product.stockMovements[0].type,
            quantity: product.stockMovements[0].quantity,
            previousStock: product.stockMovements[0].previousStock,
            newStock: product.stockMovements[0].newStock,
            reason: product.stockMovements[0].reason,
            reference: product.stockMovements[0].reference,
            status: product.stockMovements[0].status,
            notes: product.stockMovements[0].notes,
            createdAt: product.stockMovements[0].createdAt,
            user: product.stockMovements[0].user,
          }
        : null,
      hasMovements: product.stockMovements.length > 0,
      stockStatus: this.getStockStatus(
        product.stock,
        /* product.criticalStock, */
        5,
        product.minStock,
      ),
    }));
  }

  private getStockStatus(
    currentStock: number,
    criticalStock: number,
    minStock: number,
  ): string {
    if (currentStock <= 0) return 'OUT_OF_STOCK';
    if (currentStock <= criticalStock) return 'CRITICAL';
    if (currentStock <= minStock) return 'LOW';
    return 'OK';
  }
}
