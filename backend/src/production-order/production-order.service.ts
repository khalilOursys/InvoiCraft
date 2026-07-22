// src/production-order/production-order.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UnitConverter } from '../utils/unit-converter.util';
import { UnitService } from '../unit/unit.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';

@Injectable()
export class ProductionOrderService {
  constructor(
    private prisma: PrismaService,
    private unitService: UnitService,
    private unitConverter: UnitConverter,
  ) {}

  // ==================== HELPER FUNCTIONS ====================

  private async calculateTotalMaterialNeeded(
    materialAmount: number,
    quantity: number,
    materialUnitId: number,
    rawMaterialUnitId: number,
  ): Promise<number> {
    // Calculate total material needed in material unit
    const totalInMaterialUnit = materialAmount * quantity;

    // Convert total to raw material unit for stock deduction
    const amountInRawUnit = await this.unitConverter.convert(
      totalInMaterialUnit,
      materialUnitId,
      rawMaterialUnitId,
    );

    return amountInRawUnit;
  }

  private async checkRawMaterialStock(
    rawMaterial: any,
    amountNeeded: number,
    materialName: string,
    quantity: number,
    productionOrderName: string,
  ): Promise<void> {
    if (rawMaterial.amount < amountNeeded) {
      const unit = await this.unitService.getUnitById(rawMaterial.unitId);
      throw new BadRequestException(
        `Insufficient stock for ${materialName}. ` +
          `Available: ${rawMaterial.amount} ${unit.symbol}, ` +
          `Required: ${amountNeeded} ${unit.symbol} ` +
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

  private async validateUnits(
    materialUnitId: number,
    rawMaterialUnitId: number,
  ): Promise<void> {
    // Check if material unit and raw material unit are compatible
    const compatible = await this.unitConverter.areUnitsCompatible(
      materialUnitId,
      rawMaterialUnitId,
    );

    if (!compatible) {
      const mUnit = await this.unitService.getUnitById(materialUnitId);
      const rmUnit = await this.unitService.getUnitById(rawMaterialUnitId);

      throw new BadRequestException(
        `Incompatible units: Material uses ${mUnit.code} (${mUnit.family}), ` +
          `Raw material uses ${rmUnit.code} (${rmUnit.family})`,
      );
    }
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
          include: { unit: true },
        });

        if (!rawMaterial) {
          throw new NotFoundException(
            `Raw material with ID ${material.rawMaterialId} not found`,
          );
        }

        // Validate material unit and raw material unit are compatible
        await this.validateUnits(material.unitId, rawMaterial.unitId);

        // Get the material unit for display
        const materialUnit = await this.unitService.getUnitById(
          material.unitId,
        );

        // Calculate total material needed in raw material unit
        const amountInRawUnit = await this.calculateTotalMaterialNeeded(
          material.amount,
          data.amount,
          material.unitId,
          rawMaterial.unitId,
        );

        console.log({
          step: 'CREATE - Raw Material Deduction',
          productionOrderId: 'New',
          productionOrderQuantity: data.amount,
          materialName: rawMaterial.name,
          materialAmount: material.amount,
          materialUnit: materialUnit.code,
          rawMaterialUnit: rawMaterial.unit.code,
          totalMaterialNeeded: material.amount * data.amount,
          amountInRawUnit: amountInRawUnit,
          rawMaterialCurrentStock: rawMaterial.amount,
          rawMaterialNewStock: rawMaterial.amount - amountInRawUnit,
        });

        await this.checkRawMaterialStock(
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

    const salePrice = this.calculateSalePrice(
      totalCost,
      data.marginPercent || 30,
    );

    // Create production order
    const productionOrder = await this.prisma.productionOrder.create({
      data: {
        unitId: data.unitId,
        amount: data.amount,
        productId: data.productId,
        marginPercent: data.marginPercent || 30,
        vat: data.vat || 19,
        totalCost,
        salePrice,
        orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
        expectedDelivery: data.expectedDelivery
          ? new Date(data.expectedDelivery)
          : undefined,
        status: data.status || 'PENDING',
        priority: data.priority || 'MEDIUM',
        notes: data.notes,
        quantityProduced: data.quantityProduced,
        wasteAmount: data.wasteAmount,
        productionOrderMaterials: {
          create: (data.materials || []).map((m) => ({
            rawMaterialId: m.rawMaterialId,
            amount: m.amount,
            unitId: m.unitId,
          })),
        },
        productionOrderServices: {
          create: (data.serviceIds || []).map((id) => ({
            serviceId: id,
          })),
        },
      },
      include: {
        productionOrderMaterials: {
          include: {
            rawMaterial: {
              include: { unit: true },
            },
            unit: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
        unit: true,
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
            rawMaterial: {
              include: { unit: true },
            },
            unit: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
        unit: true,
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
            rawMaterial: {
              include: { unit: true },
            },
            unit: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
        unit: true,
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
            rawMaterial: {
              include: { unit: true },
            },
            unit: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
        unit: true,
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
            rawMaterial: {
              include: { unit: true },
            },
            unit: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
        unit: true,
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

    const currentQuantity = data.amount || existing.amount;

    // Handle materials update
    if (data.materials !== undefined) {
      // Return old materials
      for (const oldMaterial of existing.productionOrderMaterials) {
        const rawMaterial = await this.prisma.rawMaterial.findUnique({
          where: { id: oldMaterial.rawMaterialId },
          include: { unit: true },
        });

        if (rawMaterial) {
          const amountToReturn = await this.calculateTotalMaterialNeeded(
            oldMaterial.amount,
            currentQuantity,
            oldMaterial.unitId,
            rawMaterial.unitId,
          );

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
          include: { unit: true },
        });

        if (!rawMaterial) {
          throw new NotFoundException(
            `Raw material with ID ${newMaterial.rawMaterialId} not found`,
          );
        }

        await this.validateUnits(newMaterial.unitId, rawMaterial.unitId);

        const amountToDeduct = await this.calculateTotalMaterialNeeded(
          newMaterial.amount,
          currentQuantity,
          newMaterial.unitId,
          rawMaterial.unitId,
        );

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
          unitId: m.unitId,
        })),
      });
    } else {
      // Calculate cost from existing materials
      for (const material of existing.productionOrderMaterials) {
        const rawMaterial = await this.prisma.rawMaterial.findUnique({
          where: { id: material.rawMaterialId },
          include: { unit: true },
        });

        if (rawMaterial) {
          const amountInRawUnit = await this.calculateTotalMaterialNeeded(
            material.amount,
            currentQuantity,
            material.unitId,
            rawMaterial.unitId,
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

    const updatedProductionOrder = await this.prisma.productionOrder.update({
      where: { id },
      data: updateData,
      include: {
        productionOrderMaterials: {
          include: {
            rawMaterial: {
              include: { unit: true },
            },
            unit: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
        unit: true,
      },
    });

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

  // ==================== COMPLETE ORDER ====================

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
          include: { unit: true },
        });

        if (!rawMaterial) {
          throw new NotFoundException(
            `Raw material with ID ${material.rawMaterialId} not found`,
          );
        }

        const amountInRawUnit = await this.calculateTotalMaterialNeeded(
          material.amount,
          actualQuantity,
          material.unitId,
          rawMaterial.unitId,
        );

        await this.checkRawMaterialStock(
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
              rawMaterial: {
                include: { unit: true },
              },
              unit: true,
            },
          },
          productionOrderServices: {
            include: {
              service: true,
            },
          },
          product: true,
          unit: true,
        },
      });

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
            rawMaterial: {
              include: { unit: true },
            },
            unit: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
        unit: true,
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
            rawMaterial: {
              include: { unit: true },
            },
            unit: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
        unit: true,
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
        include: { unit: true },
      });

      if (rawMaterial) {
        const amountInRawUnit = await this.calculateTotalMaterialNeeded(
          material.amount,
          productionOrder.amount,
          material.unitId,
          rawMaterial.unitId,
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
            rawMaterial: {
              include: { unit: true },
            },
            unit: true,
          },
        },
        productionOrderServices: {
          include: {
            service: true,
          },
        },
        product: true,
        unit: true,
      },
    });
  }

  async recalculatePriceByProductId(productId: number) {
    const productionOrder = await this.findOneByProductId(productId);
    return this.recalculatePrice(productionOrder.id);
  }
}
