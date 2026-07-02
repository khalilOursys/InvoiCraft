// src/inventory/stock-alert.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateStockAlertDto } from './dto/stock-alert.dto';

@Injectable()
export class StockAlertService {
  constructor(private readonly prisma: PrismaService) {}

  async getProductAlert(productId: number) {
    const alert = await this.prisma.stockAlert.findUnique({
      where: { productId },
    });

    if (!alert) {
      // Create default alert config if not exists
      return await this.createDefaultAlert(productId);
    }

    return alert;
  }

  async updateProductAlert(productId: number, data: UpdateStockAlertDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    const existing = await this.prisma.stockAlert.findUnique({
      where: { productId },
    });

    if (existing) {
      return await this.prisma.stockAlert.update({
        where: { id: existing.id },
        data: {
          minThreshold: data.minThreshold,
          criticalThreshold: data.criticalThreshold,
          maxThreshold: data.maxThreshold,
          reorderQuantity: data.reorderQuantity,
          notifyEmail: data.notifyEmail,
          notifyDashboard: data.notifyDashboard,
          isActive: data.isActive,
        },
      });
    } else {
      return await this.prisma.stockAlert.create({
        data: {
          productId,
          minThreshold: data.minThreshold || 5,
          criticalThreshold: data.criticalThreshold || 2,
          maxThreshold: data.maxThreshold,
          reorderQuantity: data.reorderQuantity,
          notifyEmail: data.notifyEmail ?? true,
          notifyDashboard: data.notifyDashboard ?? true,
          isActive: data.isActive ?? true,
        },
      });
    }
  }

  private async createDefaultAlert(productId: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    return await this.prisma.stockAlert.create({
      data: {
        productId,
        minThreshold: product.minStock || 5,
        criticalThreshold: 2,
      },
    });
  }

  async bulkUpdateAlerts(productIds: number[], data: UpdateStockAlertDto) {
    const results = [];
    for (const productId of productIds) {
      try {
        const updated = await this.updateProductAlert(productId, data);
        results.push({ productId, success: true, alert: updated });
      } catch (error: any) {
        results.push({ productId, success: false, error: error.message });
      }
    }
    return results;
  }

  async getLowStockProducts() {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        isInventoryTracked: true,
        stock: {
          lte: this.prisma.product.fields.minStock,
        },
      },
      include: {
        stockAlert: true,
        category: true,
      },
      orderBy: { stock: 'asc' },
    });

    return products.map((product) => ({
      ...product,
      reorderNeeded:
        product.stock <=
        (product.stockAlert?.minThreshold || product.minStock || 0),
      recommendedReorderQuantity:
        product.stockAlert?.reorderQuantity || product.minStock * 2,
    }));
  }
}
