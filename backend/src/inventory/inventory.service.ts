// src/inventory/inventory.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import { Prisma, StockMovementType, StockMovementStatus } from '@prisma/client';
import { StockMovementService } from './stock-movement.service';
import {
  CreateInventoryCountDto,
  SubmitInventoryCountDto,
} from './dto/create-inventory-count.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
  ) {}

  async getProductInventory(productId: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        stockAlert: true,
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    const availableStock = product.stock - (product.reservedStock || 0);
    const status = this.getStockStatus(
      product.stock,
      product.minStock || 0,
      product.criticalStock || 2,
    );

    return {
      id: product.id,
      name: product.name,
      reference: product.reference,
      currentStock: product.stock,
      reservedStock: product.reservedStock || 0,
      availableStock,
      minStock: product.minStock,
      criticalStock: product.criticalStock,
      status,
      lastStockUpdate: product.lastStockUpdate,
      alertConfig: product.stockAlert,
      recentMovements: product.stockMovements,
    };
  }

  async getAllInventorySummary(filters?: {
    lowStock?: boolean;
    criticalStock?: boolean;
    categoryId?: number;
    brandId?: number;
  }) {
    const where: Prisma.ProductWhereInput = {
      isInventoryTracked: true,
    };

    /* if (filters?.lowStock) {
      where.stock = { lte: where.minStock };
    }

    if (filters?.criticalStock) {
      where.stock = { lte: where.criticalStock };
    } */

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.brandId) {
      where.brandId = filters.brandId;
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        brand: true,
        stockAlert: true,
      },
      orderBy: { stock: 'asc' },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      reference: product.reference,
      currentStock: product.stock,
      reservedStock: product.reservedStock || 0,
      availableStock: product.stock - (product.reservedStock || 0),
      minStock: product.minStock,
      criticalStock: product.criticalStock,
      status: this.getStockStatus(
        product.stock,
        product.minStock || 0,
        product.criticalStock || 2,
      ),
      category: product.category?.name,
      brand: product.brand?.name,
      alertConfig: product.stockAlert,
    }));
  }

  async adjustStock(
    productId: number,
    userId: number,
    adjustDto: AdjustStockDto,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    const newStock = product.stock + adjustDto.quantity;

    if (newStock < 0) {
      throw new BadRequestException(
        'Insufficient stock. Cannot reduce below zero.',
      );
    }

    // Create stock movement
    const movementDto: CreateStockMovementDto = {
      productId: productId,
      type:
        adjustDto.quantity >= 0
          ? StockMovementType.ADJUSTMENT
          : StockMovementType.LOSS,
      quantity: Math.abs(adjustDto.quantity),
      reason: adjustDto.reason,
      notes: adjustDto.notes,
      status: StockMovementStatus.COMPLETED,
    };

    const movement = await this.stockMovementService.createStockMovement(
      productId,
      userId,
      movementDto,
    );

    // Update product stock
    const updatedProduct = await this.prisma.product.update({
      where: { id: productId },
      data: {
        stock: newStock,
        lastStockUpdate: new Date(),
        ...(adjustDto.quantity < 0 && {
          reservedStock: {
            decrement: Math.min(
              product.reservedStock || 0,
              Math.abs(adjustDto.quantity),
            ),
          },
        }),
      },
    });

    // Check and create alerts if needed
    await this.checkAndCreateAlerts(productId, updatedProduct.stock);

    return {
      product: updatedProduct,
      movement,
      previousStock: product.stock,
      newStock,
      adjustment: adjustDto.quantity,
    };
  }

  async reserveStock(userId: number, reserveDto: ReserveStockDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: reserveDto.productId },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with id ${reserveDto.productId} not found`,
      );
    }

    const availableStock = product.stock - (product.reservedStock || 0);

    if (availableStock < reserveDto.quantity) {
      throw new BadRequestException(
        `Insufficient available stock. Available: ${availableStock}, Requested: ${reserveDto.quantity}`,
      );
    }

    const expirationMinutes = reserveDto.expirationMinutes || 30;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

    // Create reservation
    const reservation = await this.prisma.stockReservation.create({
      data: {
        reservationNumber: `RES-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        quantity: reserveDto.quantity,
        expiresAt,
        productId: reserveDto.productId,
        orderId: reserveDto.orderId,
        sessionId: reserveDto.sessionId,
        isActive: true,
      },
    });

    // Update product reserved stock
    await this.prisma.product.update({
      where: { id: reserveDto.productId },
      data: {
        reservedStock: {
          increment: reserveDto.quantity,
        },
      },
    });

    return reservation;
  }

  async releaseReservation(reservationId: number, userId: number) {
    const reservation = await this.prisma.stockReservation.findUnique({
      where: { id: reservationId },
      include: { product: true },
    });

    if (!reservation) {
      throw new NotFoundException(
        `Reservation with id ${reservationId} not found`,
      );
    }

    if (!reservation.isActive) {
      throw new BadRequestException('Reservation is already released');
    }

    // Release the reservation
    await this.prisma.$transaction([
      this.prisma.stockReservation.update({
        where: { id: reservationId },
        data: { isActive: false },
      }),
      this.prisma.product.update({
        where: { id: reservation.productId },
        data: {
          reservedStock: {
            decrement: reservation.quantity,
          },
        },
      }),
    ]);

    return { message: 'Reservation released successfully', reservationId };
  }

  async createInventoryCount(userId: number, data: CreateInventoryCountDto) {
    const countNumber = `COUNT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // Get all active products
    const products = await this.prisma.product.findMany({
      where: { isActive: true, isInventoryTracked: true },
      select: { id: true, stock: true },
    });

    return await this.prisma.inventoryCount.create({
      data: {
        countNumber,
        name: data.name,
        scheduledDate: new Date(data.scheduledDate),
        status: 'DRAFT',
        createdBy: userId,
        items: {
          create: products.map((product) => ({
            productId: product.id,
            expectedQuantity: product.stock,
            countedQuantity: product.stock, // Initial value same as expected
            difference: 0,
          })),
        },
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });
  }

  async submitInventoryCount(
    countId: number,
    userId: number,
    data: SubmitInventoryCountDto,
  ) {
    const inventoryCount = await this.prisma.inventoryCount.findUnique({
      where: { id: countId },
      include: { items: true },
    });

    if (!inventoryCount) {
      throw new NotFoundException(
        `Inventory count with id ${countId} not found`,
      );
    }

    if (inventoryCount.status !== 'DRAFT') {
      throw new BadRequestException(
        'Inventory count is already completed or cancelled',
      );
    }

    const updates = [];
    const movements = [];

    for (const item of data.items) {
      const countItem = inventoryCount.items.find(
        (i) => i.productId === item.productId,
      );
      if (!countItem) continue;

      const difference = item.countedQuantity - countItem.expectedQuantity;

      updates.push(
        this.prisma.inventoryCountItem.update({
          where: { id: countItem.id },
          data: {
            countedQuantity: item.countedQuantity,
            difference,
            notes: item.notes,
          },
        }),
      );

      if (difference !== 0) {
        // Create stock movement for the adjustment
        movements.push(
          this.stockMovementService.createStockMovement(
            item.productId,
            userId,
            {
              productId: item.productId,
              type:
                difference > 0
                  ? StockMovementType.INBOUND
                  : StockMovementType.OUTBOUND,
              quantity: Math.abs(difference),
              reason: `Physical inventory count adjustment`,
              reference: inventoryCount.countNumber,
              status: StockMovementStatus.COMPLETED,
            },
            true, // Skip stock update (we'll update manually)
          ),
        );

        // Update product stock
        updates.push(
          this.prisma.product.update({
            where: { id: item.productId },
            data: {
              stock: item.countedQuantity,
              lastStockUpdate: new Date(),
            },
          }),
        );
      }
    }

    // Execute all updates
    await this.prisma.$transaction(updates);

    // Execute movements if any
    if (movements.length > 0) {
      await Promise.all(movements);
    }

    // Complete the inventory count
    return await this.prisma.inventoryCount.update({
      where: { id: countId },
      data: {
        status: 'COMPLETED',
        completedDate: new Date(),
        completedBy: userId,
      },
      include: { items: true },
    });
  }

  async getStockAlerts() {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        isInventoryTracked: true,
        OR: [
          { stock: { lte: this.prisma.product.fields.minStock } },
          { stock: { lte: this.prisma.product.fields.criticalStock } },
        ],
      },
      include: {
        stockAlert: true,
        category: true,
        brand: true,
      },
      orderBy: { stock: 'asc' },
    });

    return products.map((product) => ({
      ...product,
      status: this.getStockStatus(
        product.stock,
        product.minStock || 0,
        product.criticalStock || 2,
      ),
      alertConfig: product.stockAlert,
    }));
  }

  private getStockStatus(
    stock: number,
    minStock: number,
    criticalStock: number,
  ): string {
    if (stock <= 0) return 'OUT_OF_STOCK';
    if (stock <= criticalStock) return 'CRITICAL';
    if (stock <= minStock) return 'LOW_STOCK';
    return 'OK';
  }

  private async checkAndCreateAlerts(productId: number, currentStock: number) {
    const alertConfig = await this.prisma.stockAlert.findUnique({
      where: { productId },
    });

    if (!alertConfig || !alertConfig.isActive) return;

    const status = this.getStockStatus(
      currentStock,
      alertConfig.minThreshold,
      alertConfig.criticalThreshold,
    );

    const shouldAlert =
      (status === 'LOW_STOCK' || status === 'CRITICAL') &&
      (!alertConfig.lastAlertSent ||
        new Date().getTime() - new Date(alertConfig.lastAlertSent).getTime() >
          3600000); // 1 hour cooldown

    if (shouldAlert) {
      await this.prisma.stockAlert.update({
        where: { id: alertConfig.id },
        data: {
          lastAlertSent: new Date(),
          lastAlertType: status as any,
        },
      });
    }
  }
}
