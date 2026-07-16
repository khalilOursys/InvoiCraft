import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UnitConverter } from '../utils/unit-converter.util';
import {
  CreateProductionOrderDto,
  ProductionOrderStatus,
} from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';

@Injectable()
export class ProductionOrderService {
  constructor(private prisma: PrismaService) {}

  // ==================== HELPER FUNCTIONS ====================

  private calculateTotalMaterialNeeded(
    materialPerUnit: number,
    quantity: number,
    productionOrderUnit: string,
    rawMaterialUnit: string,
  ): number {
    const totalMaterialNeeded = materialPerUnit * quantity;
    const amountInRawUnit = UnitConverter.convert(
      totalMaterialNeeded,
      productionOrderUnit,
      rawMaterialUnit,
    );
    return amountInRawUnit;
  }

  private checkRawMaterialStock(
    rawMaterial: any,
    amountNeeded: number,
    materialName: string,
    quantity: number,
    productionOrderName: string,
  ): void {
    if (rawMaterial.amount < amountNeeded) {
      throw new BadRequestException(
        `Insufficient stock for ${materialName}. ` +
          `Available: ${rawMaterial.amount} ${rawMaterial.unit}, ` +
          `Required: ${amountNeeded} ${rawMaterial.unit} ` +
          `for ${quantity} units of ${productionOrderName}`,
      );
    }
  }

  private async deductRawMaterialStock(
    rawMaterialId: number,
    amountToDeduct: number,
  ): Promise<void> {
    await this.prisma.rawMaterial.update({
      where: { id: rawMaterialId },
      data: {
        amount: {
          decrement: amountToDeduct,
        },
      },
    });
  }

  private async returnRawMaterialStock(
    rawMaterialId: number,
    amountToReturn: number,
  ): Promise<void> {
    await this.prisma.rawMaterial.update({
      where: { id: rawMaterialId },
      data: {
        amount: {
          increment: amountToReturn,
        },
      },
    });
  }

  private async calculateTotalServiceCost(
    serviceIds: number[],
  ): Promise<number> {
    let totalCost = 0;
    for (const serviceId of serviceIds) {
      const service = await this.prisma.service.findUnique({
        where: { id: serviceId },
      });
      if (!service) {
        throw new NotFoundException(`Service with ID ${serviceId} not found`);
      }
      totalCost += service.price;
    }
    return totalCost;
  }

  private calculateSalePrice(totalCost: number, marginPercent: number): number {
    return totalCost * (1 + marginPercent / 100);
  }

  // ==================== PRODUCT STOCK SYNC FUNCTIONS ====================

  private async addToProductStock(
    productId: number,
    quantityToAdd: number,
  ): Promise<void> {
    if (!productId || quantityToAdd <= 0) return;

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        stock: {
          increment: quantityToAdd,
        },
      },
    });

    console.log({
      step: 'PRODUCT STOCK - ADD',
      productId: productId,
      quantityAdded: quantityToAdd,
    });
  }

  private async subtractFromProductStock(
    productId: number,
    quantityToSubtract: number,
  ): Promise<void> {
    if (!productId || quantityToSubtract <= 0) return;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    if (product.stock < quantityToSubtract) {
      throw new BadRequestException(
        `Insufficient product stock. Available: ${product.stock}, Required: ${quantityToSubtract}`,
      );
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        stock: {
          decrement: quantityToSubtract,
        },
      },
    });

    console.log({
      step: 'PRODUCT STOCK - SUBTRACT',
      productId: productId,
      quantitySubtracted: quantityToSubtract,
    });
  }

  private async syncProductStock(
    productId: number,
    oldQuantity: number,
    newQuantity: number,
  ): Promise<void> {
    if (!productId) return;

    const quantityDifference = newQuantity - oldQuantity;

    if (quantityDifference > 0) {
      await this.addToProductStock(productId, quantityDifference);
    } else if (quantityDifference < 0) {
      await this.subtractFromProductStock(
        productId,
        Math.abs(quantityDifference),
      );
    }
  }

  // ==================== CREATE ====================

  async create(data: CreateProductionOrderDto) {
    let totalCost = 0;

    // Process raw materials
    if (data.materials && data.materials.length > 0) {
      for (const material of data.materials) {
        const rawMaterial = await this.prisma.rawMaterial.findUnique({
          where: { id: material.rawMaterialId },
        });

        if (!rawMaterial) {
          throw new NotFoundException(
            `Raw material with ID ${material.rawMaterialId} not found`,
          );
        }

        if (!UnitConverter.areUnitsCompatible(data.unit, rawMaterial.unit)) {
          throw new BadRequestException(
            `Incompatible units: Production order uses ${data.unit}, ` +
              `Raw material ${rawMaterial.name} uses ${rawMaterial.unit}`,
          );
        }

        const amountInRawUnit = this.calculateTotalMaterialNeeded(
          material.amount,
          data.amount,
          data.unit,
          rawMaterial.unit,
        );

        console.log({
          step: 'CREATE - Raw Material Deduction',
          productionOrderId: 'New',
          productionOrderQuantity: data.amount,
          materialName: rawMaterial.name,
          materialPerUnit: material.amount,
          totalMaterialNeeded: material.amount * data.amount,
          amountInRawUnit: amountInRawUnit,
          rawMaterialCurrentStock: rawMaterial.amount,
          rawMaterialNewStock: rawMaterial.amount - amountInRawUnit,
        });

        this.checkRawMaterialStock(
          rawMaterial,
          amountInRawUnit,
          rawMaterial.name,
          data.amount,
          `Production Order ${data.orderDate || 'New'}`,
        );

        totalCost += rawMaterial.purchasePrice * amountInRawUnit;
        await this.deductRawMaterialStock(
          material.rawMaterialId,
          amountInRawUnit,
        );
      }
    }

    // Process services
    if (data.serviceIds && data.serviceIds.length > 0) {
      totalCost += await this.calculateTotalServiceCost(data.serviceIds);
    }

    const salePrice = this.calculateSalePrice(totalCost, data.marginPercent);

    // Create production order
    const productionOrder = await this.prisma.productionOrder.create({
      data: {
        unit: data.unit,
        amount: data.amount,
        productId: data.productId,
        marginPercent: data.marginPercent,
        vat: data.vat,
        totalCost,
        salePrice,
        orderDate: data.orderDate || new Date(),
        expectedDelivery: data.expectedDelivery,
        status: data.status || 'PENDING',
        priority: data.priority || 'MEDIUM',
        notes: data.notes,
        quantityProduced: data.quantityProduced,
        wasteAmount: data.wasteAmount,
        productionOrderMaterials: {
          create: data.materials.map((m) => ({
            rawMaterialId: m.rawMaterialId,
            amount: m.amount,
          })),
        },
        productionOrderServices: {
          create: data.serviceIds.map((id) => ({
            serviceId: id,
          })),
        },
      },
      include: {
        productionOrderMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
      },
    });

    // SYNC: Add production order quantity to product stock
    if (data.productId) {
      await this.addToProductStock(data.productId, data.amount);
    }

    return productionOrder;
  }

  // ==================== READ ====================

  async findAll() {
    return this.prisma.productionOrder.findMany({
      where: { isActive: true },
      include: {
        productionOrderMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByProductId(productId: number) {
    return this.prisma.productionOrder.findMany({
      where: {
        productId: productId,
        isActive: true,
      },
      include: {
        productionOrderMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const productionOrder = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        productionOrderMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
      },
    });

    if (!productionOrder) {
      throw new NotFoundException(`Production order with ID ${id} not found`);
    }

    return productionOrder;
  }

  async findOneByProductId(productId: number) {
    const productionOrder = await this.prisma.productionOrder.findFirst({
      where: {
        productId: productId,
        isActive: true,
      },
      include: {
        productionOrderMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!productionOrder) {
      throw new NotFoundException(
        `Production order with productId ${productId} not found`,
      );
    }

    return productionOrder;
  }

  // ==================== UPDATE ====================

  async update(id: number, data: UpdateProductionOrderDto) {
    const existing = await this.findOne(id);
    const updateData: any = { ...data };
    let totalCost = 0;

    // Handle materials update
    if (data.materials !== undefined) {
      const quantity = data.amount || existing.amount;
      const unit = data.unit || existing.unit;

      // Return old materials
      for (const oldMaterial of existing.productionOrderMaterials) {
        const rawMaterial = await this.prisma.rawMaterial.findUnique({
          where: { id: oldMaterial.rawMaterialId },
        });
        if (rawMaterial) {
          const amountToReturn = this.calculateTotalMaterialNeeded(
            oldMaterial.amount,
            quantity,
            unit,
            rawMaterial.unit,
          );
          console.log({
            step: 'UPDATE - Return Old Materials',
            materialName: rawMaterial.name,
            amountToReturn: amountToReturn,
            rawMaterialCurrentStock: rawMaterial.amount,
            rawMaterialNewStock: rawMaterial.amount + amountToReturn,
          });
          await this.returnRawMaterialStock(
            oldMaterial.rawMaterialId,
            amountToReturn,
          );
        }
      }

      // Delete old materials
      await this.prisma.productionOrderMaterial.deleteMany({
        where: { productionOrderId: id },
      });

      // Deduct new materials
      for (const newMaterial of data.materials) {
        const rawMaterial = await this.prisma.rawMaterial.findUnique({
          where: { id: newMaterial.rawMaterialId },
        });

        if (!rawMaterial) {
          throw new NotFoundException(
            `Raw material with ID ${newMaterial.rawMaterialId} not found`,
          );
        }

        if (!UnitConverter.areUnitsCompatible(unit, rawMaterial.unit)) {
          throw new BadRequestException(
            `Incompatible units: Production order uses ${unit}, ` +
              `Raw material ${rawMaterial.name} uses ${rawMaterial.unit}`,
          );
        }

        const amountToDeduct = this.calculateTotalMaterialNeeded(
          newMaterial.amount,
          quantity,
          unit,
          rawMaterial.unit,
        );

        console.log({
          step: 'UPDATE - Deduct New Materials',
          materialName: rawMaterial.name,
          amountToDeduct: amountToDeduct,
          rawMaterialCurrentStock: rawMaterial.amount,
          rawMaterialNewStock: rawMaterial.amount - amountToDeduct,
        });

        totalCost += rawMaterial.purchasePrice * amountToDeduct;
        await this.deductRawMaterialStock(
          newMaterial.rawMaterialId,
          amountToDeduct,
        );
      }

      // Create new material relations
      await this.prisma.productionOrderMaterial.createMany({
        data: data.materials.map((m) => ({
          productionOrderId: id,
          rawMaterialId: m.rawMaterialId,
          amount: m.amount,
        })),
      });
    } else {
      // Calculate cost from existing materials
      const quantity = data.amount || existing.amount;
      for (const material of existing.productionOrderMaterials) {
        const rawMaterial = await this.prisma.rawMaterial.findUnique({
          where: { id: material.rawMaterialId },
        });
        if (rawMaterial) {
          const amountInRawUnit = this.calculateTotalMaterialNeeded(
            material.amount,
            quantity,
            existing.unit,
            rawMaterial.unit,
          );
          totalCost += rawMaterial.purchasePrice * amountInRawUnit;
        }
      }
    }

    // Handle services update
    if (data.serviceIds !== undefined) {
      await this.prisma.productionOrderService.deleteMany({
        where: { productionOrderId: id },
      });

      if (data.serviceIds.length > 0) {
        for (const serviceId of data.serviceIds) {
          const service = await this.prisma.service.findUnique({
            where: { id: serviceId },
          });
          if (!service) {
            throw new NotFoundException(
              `Service with ID ${serviceId} not found`,
            );
          }
          totalCost += service.price;
        }

        await this.prisma.productionOrderService.createMany({
          data: data.serviceIds.map((serviceId) => ({
            productionOrderId: id,
            serviceId: serviceId,
          })),
        });
      }
    } else {
      for (const service of existing.productionOrderServices) {
        const serviceData = await this.prisma.service.findUnique({
          where: { id: service.serviceId },
        });
        if (serviceData) {
          totalCost += serviceData.price;
        }
      }
    }

    const marginPercent =
      data.marginPercent !== undefined
        ? data.marginPercent
        : existing.marginPercent;
    const salePrice = this.calculateSalePrice(totalCost, marginPercent);

    updateData.totalCost = totalCost;
    updateData.salePrice = salePrice;

    // Handle status updates
    if (data.status === 'COMPLETED' && !existing.completedAt) {
      updateData.completedAt = new Date();
    }
    if (data.status === 'CANCELLED' && !existing.cancelledAt) {
      updateData.cancelledAt = new Date();
    }

    delete updateData.materials;
    delete updateData.serviceIds;

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Update production order
    const updatedProductionOrder = await this.prisma.productionOrder.update({
      where: { id },
      data: updateData,
      include: {
        productionOrderMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
      },
    });

    // SYNC: Update product stock based on quantity change
    if (updatedProductionOrder.productId) {
      const oldQuantity = existing.amount;
      const newQuantity = data.amount !== undefined ? data.amount : oldQuantity;
      await this.syncProductStock(
        updatedProductionOrder.productId,
        oldQuantity,
        newQuantity,
      );
    }

    return updatedProductionOrder;
  }

  async updateByProductId(productId: number, data: UpdateProductionOrderDto) {
    const existing = await this.findOneByProductId(productId);
    return this.update(existing.id, data);
  }

  // ==================== DELETE ====================

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.productionOrder.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ==================== SELL / COMPLETE ORDER ====================

  async completeOrder(id: number, quantityProduced?: number) {
    const productionOrder = await this.findOne(id);

    if (productionOrder.status === 'COMPLETED') {
      throw new BadRequestException('Production order is already completed');
    }

    if (productionOrder.status === 'CANCELLED') {
      throw new BadRequestException('Cannot complete a cancelled order');
    }

    const actualQuantity = quantityProduced || productionOrder.amount;

    if (actualQuantity <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    return this.prisma.$transaction(async (prisma) => {
      // Deduct raw materials for the actual quantity produced
      for (const material of productionOrder.productionOrderMaterials) {
        const rawMaterial = await prisma.rawMaterial.findUnique({
          where: { id: material.rawMaterialId },
        });

        if (!rawMaterial) {
          throw new NotFoundException(
            `Raw material with ID ${material.rawMaterialId} not found`,
          );
        }

        const amountInRawUnit = this.calculateTotalMaterialNeeded(
          material.amount,
          actualQuantity,
          productionOrder.unit,
          rawMaterial.unit,
        );

        console.log({
          step: 'COMPLETE ORDER - Raw Material Deduction',
          productionOrderId: productionOrder.id,
          quantityProduced: actualQuantity,
          materialName: rawMaterial.name,
          materialPerUnit: material.amount,
          totalMaterialNeeded: material.amount * actualQuantity,
          amountInRawUnit: amountInRawUnit,
          rawMaterialCurrentStock: rawMaterial.amount,
          rawMaterialNewStock: rawMaterial.amount - amountInRawUnit,
        });

        this.checkRawMaterialStock(
          rawMaterial,
          amountInRawUnit,
          rawMaterial.name,
          actualQuantity,
          `Production Order ${productionOrder.id}`,
        );

        await this.deductRawMaterialStock(
          material.rawMaterialId,
          amountInRawUnit,
        );
      }

      // Update production order
      const updatedProductionOrder = await prisma.productionOrder.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          quantityProduced: actualQuantity,
        },
        include: {
          productionOrderMaterials: {
            include: {
              rawMaterial: true,
            },
          },
          productionOrderServices: {
            include: {
              service: true,
            },
          },
          product: true,
        },
      });

      // SYNC: Add to product stock
      if (updatedProductionOrder.productId) {
        await this.addToProductStock(
          updatedProductionOrder.productId,
          actualQuantity,
        );
      }

      return updatedProductionOrder;
    });
  }

  async cancelOrder(id: number, notes?: string) {
    const productionOrder = await this.findOne(id);

    if (productionOrder.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel a completed order');
    }

    if (productionOrder.status === 'CANCELLED') {
      throw new BadRequestException('Order is already cancelled');
    }

    return this.prisma.productionOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        notes: notes
          ? `${productionOrder.notes || ''}\n${notes}`
          : productionOrder.notes,
      },
      include: {
        productionOrderMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
      },
    });
  }

  // ==================== UPDATE STOCK ====================

  async updateStock(id: number, newAmount: number) {
    if (newAmount < 0) {
      throw new BadRequestException('Amount cannot be negative');
    }

    const existing = await this.findOne(id);

    const updatedProductionOrder = await this.prisma.productionOrder.update({
      where: { id },
      data: { amount: newAmount },
      include: {
        productionOrderMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
      },
    });

    if (updatedProductionOrder.productId) {
      await this.syncProductStock(
        updatedProductionOrder.productId,
        existing.amount,
        newAmount,
      );
    }

    return updatedProductionOrder;
  }

  async updateStockByProductId(productId: number, newAmount: number) {
    const productionOrder = await this.findOneByProductId(productId);
    return this.updateStock(productionOrder.id, newAmount);
  }

  // ==================== RECALCULATE PRICE ====================

  async recalculatePrice(id: number) {
    const productionOrder = await this.findOne(id);
    let totalCost = 0;

    for (const material of productionOrder.productionOrderMaterials) {
      const rawMaterial = await this.prisma.rawMaterial.findUnique({
        where: { id: material.rawMaterialId },
      });

      if (rawMaterial) {
        const amountInRawUnit = this.calculateTotalMaterialNeeded(
          material.amount,
          productionOrder.amount,
          productionOrder.unit,
          rawMaterial.unit,
        );
        totalCost += rawMaterial.purchasePrice * amountInRawUnit;
      }
    }

    for (const service of productionOrder.productionOrderServices) {
      const serviceData = await this.prisma.service.findUnique({
        where: { id: service.serviceId },
      });

      if (serviceData) {
        totalCost += serviceData.price;
      }
    }

    const salePrice = this.calculateSalePrice(
      totalCost,
      productionOrder.marginPercent,
    );

    return this.prisma.productionOrder.update({
      where: { id },
      data: {
        totalCost,
        salePrice,
      },
      include: {
        productionOrderMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
      },
    });
  }

  async recalculatePriceByProductId(productId: number) {
    const productionOrder = await this.findOneByProductId(productId);
    return this.recalculatePrice(productionOrder.id);
  }
}
