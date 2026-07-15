// src/craft-product/craft-product.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UnitConverter } from '../utils/unit-converter.util';
import { CreateCraftProductDto } from './dto/create-craft-product.dto';
import { UpdateCraftProductDto } from './dto/update-craft-product.dto';

@Injectable()
export class CraftProductService {
  constructor(private prisma: PrismaService) {}

  // ==================== HELPER FUNCTIONS ====================

  private calculateTotalMaterialNeeded(
    materialPerUnit: number,
    quantity: number,
    craftProductUnit: string,
    rawMaterialUnit: string,
  ): number {
    const totalMaterialNeeded = materialPerUnit * quantity;
    const amountInRawUnit = UnitConverter.convert(
      totalMaterialNeeded,
      craftProductUnit,
      rawMaterialUnit,
    );
    return amountInRawUnit;
  }

  private checkRawMaterialStock(
    rawMaterial: any,
    amountNeeded: number,
    materialName: string,
    quantity: number,
    craftProductName: string,
  ): void {
    if (rawMaterial.amount < amountNeeded) {
      throw new BadRequestException(
        `Insufficient stock for ${materialName}. ` +
          `Available: ${rawMaterial.amount} ${rawMaterial.unit}, ` +
          `Required: ${amountNeeded} ${rawMaterial.unit} ` +
          `for ${quantity} units of ${craftProductName}`,
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

  /**
   * Add quantity to product stock (increment)
   */
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

  /**
   * Subtract quantity from product stock (decrement)
   */
  private async subtractFromProductStock(
    productId: number,
    quantityToSubtract: number,
  ): Promise<void> {
    if (!productId || quantityToSubtract <= 0) return;

    // Check if product has enough stock
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

  /**
   * Sync product stock with craft product quantity
   * Calculates the difference and adds/subtracts accordingly
   */
  private async syncProductStock(
    productId: number,
    oldQuantity: number,
    newQuantity: number,
  ): Promise<void> {
    if (!productId) return;

    const quantityDifference = newQuantity - oldQuantity;

    if (quantityDifference > 0) {
      // Craft product quantity increased → ADD to product stock
      await this.addToProductStock(productId, quantityDifference);
    } else if (quantityDifference < 0) {
      // Craft product quantity decreased → SUBTRACT from product stock
      await this.subtractFromProductStock(
        productId,
        Math.abs(quantityDifference),
      );
    }
  }

  // ==================== CREATE ====================

  async create(data: CreateCraftProductDto) {
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
            `Incompatible units: Craft product uses ${data.unit}, ` +
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
          craftProductName: data.name,
          craftProductQuantity: data.amount,
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
          data.name,
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

    // Create craft product
    const craftProduct = await this.prisma.craftProduct.create({
      data: {
        reference: data.reference,
        name: data.name,
        description: data.description,
        unit: data.unit,
        amount: data.amount,
        productId: data.productId,
        marginPercent: data.marginPercent,
        vat: data.vat,
        minStock: data.minStock,
        img: data.img,
        totalCost,
        salePrice,
        craftMaterials: {
          create: data.materials.map((m) => ({
            rawMaterialId: m.rawMaterialId,
            amount: m.amount,
          })),
        },
        craftServices: {
          create: data.serviceIds.map((id) => ({
            serviceId: id,
          })),
        },
      },
      include: {
        craftMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        craftServices: {
          include: {
            service: true,
          },
        },
        product: true,
      },
    });

    // SYNC: Add craft product quantity to product stock
    if (data.productId) {
      await this.addToProductStock(data.productId, data.amount);
    }

    return craftProduct;
  }

  // ==================== READ ====================

  async findAll() {
    return this.prisma.craftProduct.findMany({
      where: { isActive: true },
      include: {
        craftMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        craftServices: {
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
    return this.prisma.craftProduct.findMany({
      where: {
        productId: productId,
        isActive: true,
      },
      include: {
        craftMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        craftServices: {
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
    const craftProduct = await this.prisma.craftProduct.findUnique({
      where: { id },
      include: {
        craftMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        craftServices: {
          include: {
            service: true,
          },
        },
        product: true,
      },
    });

    if (!craftProduct) {
      throw new NotFoundException(`Craft product with ID ${id} not found`);
    }

    return craftProduct;
  }

  async findOneByProductId(productId: number) {
    const craftProduct = await this.prisma.craftProduct.findFirst({
      where: {
        productId: productId,
        isActive: true,
      },
      include: {
        craftMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        craftServices: {
          include: {
            service: true,
          },
        },
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!craftProduct) {
      throw new NotFoundException(
        `Craft product with productId ${productId} not found`,
      );
    }

    return craftProduct;
  }

  // ==================== UPDATE ====================

  async update(id: number, data: UpdateCraftProductDto) {
    const existing = await this.findOne(id);
    const updateData: any = { ...data };
    let totalCost = 0;

    // Handle materials update
    if (data.materials !== undefined) {
      const quantity = data.amount || existing.amount;
      const unit = data.unit || existing.unit;
      const name = data.name || existing.name;

      // Return old materials
      for (const oldMaterial of existing.craftMaterials) {
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
      await this.prisma.craftProductMaterial.deleteMany({
        where: { craftProductId: id },
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
            `Incompatible units: Craft product uses ${unit}, ` +
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

        /* this.checkRawMaterialStock(
          rawMaterial,
          amountToDeduct,
          rawMaterial.name,
          quantity,
          name,
        ); */

        totalCost += rawMaterial.purchasePrice * amountToDeduct;
        await this.deductRawMaterialStock(
          newMaterial.rawMaterialId,
          amountToDeduct,
        );
      }

      // Create new material relations
      await this.prisma.craftProductMaterial.createMany({
        data: data.materials.map((m) => ({
          craftProductId: id,
          rawMaterialId: m.rawMaterialId,
          amount: m.amount,
        })),
      });
    } else {
      // Calculate cost from existing materials
      const quantity = data.amount || existing.amount;
      for (const material of existing.craftMaterials) {
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
      await this.prisma.craftProductService.deleteMany({
        where: { craftProductId: id },
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

        await this.prisma.craftProductService.createMany({
          data: data.serviceIds.map((serviceId) => ({
            craftProductId: id,
            serviceId: serviceId,
          })),
        });
      }
    } else {
      for (const service of existing.craftServices) {
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

    delete updateData.materials;
    delete updateData.serviceIds;

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Update craft product
    const updatedCraftProduct = await this.prisma.craftProduct.update({
      where: { id },
      data: updateData,
      include: {
        craftMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        craftServices: {
          include: {
            service: true,
          },
        },
        product: true,
      },
    });

    // SYNC: Update product stock based on quantity change
    if (updatedCraftProduct.productId) {
      const oldQuantity = existing.amount;
      const newQuantity = data.amount !== undefined ? data.amount : oldQuantity;
      await this.syncProductStock(
        updatedCraftProduct.productId,
        oldQuantity,
        newQuantity,
      );
    }

    return updatedCraftProduct;
  }

  async updateByProductId(productId: number, data: UpdateCraftProductDto) {
    const existing = await this.findOneByProductId(productId);
    return this.update(existing.id, data);
  }

  // ==================== DELETE ====================

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.craftProduct.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ==================== SELL ====================

  async sell(id: number, quantityToSell: number) {
    if (quantityToSell <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    const craftProduct = await this.findOne(id);

    if (craftProduct.amount === null || craftProduct.amount === undefined) {
      throw new BadRequestException('Craft product stock amount is not set');
    }

    if (craftProduct.amount < quantityToSell) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${craftProduct.amount} ${craftProduct.unit}, ` +
          `Required: ${quantityToSell} ${craftProduct.unit}`,
      );
    }

    return this.prisma.$transaction(async (prisma) => {
      // Deduct raw materials
      for (const material of craftProduct.craftMaterials) {
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
          quantityToSell,
          craftProduct.unit,
          rawMaterial.unit,
        );

        console.log({
          step: 'SELL - Raw Material Deduction',
          craftProductName: craftProduct.name,
          quantityToSell: quantityToSell,
          materialName: rawMaterial.name,
          materialPerUnit: material.amount,
          totalMaterialNeeded: material.amount * quantityToSell,
          amountInRawUnit: amountInRawUnit,
          rawMaterialCurrentStock: rawMaterial.amount,
          rawMaterialNewStock: rawMaterial.amount - amountInRawUnit,
        });
        //TODO if need this fuction correct it
        /* this.checkRawMaterialStock(
          rawMaterial,
          amountInRawUnit,
          rawMaterial.name,
          quantityToSell,
          craftProduct.name,
        ); */

        await this.deductRawMaterialStock(
          material.rawMaterialId,
          amountInRawUnit,
        );
      }

      // Decrease craft product stock
      const updatedCraftProduct = await prisma.craftProduct.update({
        where: { id },
        data: {
          amount: {
            decrement: quantityToSell,
          },
        },
        include: {
          craftMaterials: {
            include: {
              rawMaterial: true,
            },
          },
          craftServices: {
            include: {
              service: true,
            },
          },
          product: true,
        },
      });

      // SYNC: Subtract from product stock
      if (updatedCraftProduct.productId) {
        await this.subtractFromProductStock(
          updatedCraftProduct.productId,
          quantityToSell,
        );
      }

      return updatedCraftProduct;
    });
  }

  async sellByProductId(productId: number, quantityToSell: number) {
    const craftProduct = await this.findOneByProductId(productId);
    return this.sell(craftProduct.id, quantityToSell);
  }

  // ==================== UPDATE STOCK ====================

  async updateStock(id: number, newAmount: number) {
    if (newAmount < 0) {
      throw new BadRequestException('Amount cannot be negative');
    }

    const existing = await this.findOne(id);

    // Update craft product stock
    const updatedCraftProduct = await this.prisma.craftProduct.update({
      where: { id },
      data: { amount: newAmount },
      include: {
        craftMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        craftServices: {
          include: {
            service: true,
          },
        },
        product: true,
      },
    });

    // SYNC: Update product stock based on stock change
    if (updatedCraftProduct.productId) {
      await this.syncProductStock(
        updatedCraftProduct.productId,
        existing.amount,
        newAmount,
      );
    }

    return updatedCraftProduct;
  }

  async updateStockByProductId(productId: number, newAmount: number) {
    const craftProduct = await this.findOneByProductId(productId);
    return this.updateStock(craftProduct.id, newAmount);
  }

  // ==================== RECALCULATE PRICE ====================

  async recalculatePrice(id: number) {
    const craftProduct = await this.findOne(id);
    let totalCost = 0;

    for (const material of craftProduct.craftMaterials) {
      const rawMaterial = await this.prisma.rawMaterial.findUnique({
        where: { id: material.rawMaterialId },
      });

      if (rawMaterial) {
        const amountInRawUnit = this.calculateTotalMaterialNeeded(
          material.amount,
          craftProduct.amount,
          craftProduct.unit,
          rawMaterial.unit,
        );
        totalCost += rawMaterial.purchasePrice * amountInRawUnit;
      }
    }

    for (const service of craftProduct.craftServices) {
      const serviceData = await this.prisma.service.findUnique({
        where: { id: service.serviceId },
      });

      if (serviceData) {
        totalCost += serviceData.price;
      }
    }

    const salePrice = this.calculateSalePrice(
      totalCost,
      craftProduct.marginPercent,
    );

    return this.prisma.craftProduct.update({
      where: { id },
      data: {
        totalCost,
        salePrice,
      },
      include: {
        craftMaterials: {
          include: {
            rawMaterial: true,
          },
        },
        craftServices: {
          include: {
            service: true,
          },
        },
        product: true,
      },
    });
  }

  async recalculatePriceByProductId(productId: number) {
    const craftProduct = await this.findOneByProductId(productId);
    return this.recalculatePrice(craftProduct.id);
  }
}
