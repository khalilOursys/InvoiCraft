// src/products/products.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductCraftDto } from './dto/create-product-craft.dto';
import { UpdateProductCraftDto } from './dto/update-product-craft.dto';
import { Prisma } from '@prisma/client';
import { SearchProductsDto } from './dto/search-products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== PRODUCT METHODS ====================

  async create(
    createProductDto: CreateProductDto,
    imageUrl?: string,
    userId?: number,
  ) {
    if (createProductDto.reference) {
      const existingByRef = await this.prisma.product.findFirst({
        where: { reference: createProductDto.reference },
      });
      if (existingByRef) {
        throw new BadRequestException(
          `Product with reference "${createProductDto.reference}" already exists.`,
        );
      }
    }

    if (createProductDto.internalCode) {
      const existingByCode = await this.prisma.product.findFirst({
        where: { internalCode: createProductDto.internalCode },
      });
      if (existingByCode) {
        throw new BadRequestException(
          `Product with internal code "${createProductDto.internalCode}" already exists.`,
        );
      }
    }

    const category = await this.prisma.category.findUnique({
      where: { id: createProductDto.categoryId },
    });
    if (!category) {
      throw new BadRequestException(
        `Category with id ${createProductDto.categoryId} not found.`,
      );
    }

    if (createProductDto.brandId) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: createProductDto.brandId },
      });
      if (!brand) {
        throw new BadRequestException(
          `Brand with id ${createProductDto.brandId} not found.`,
        );
      }
    }

    const initialStock = createProductDto.stock || 0;

    return await this.prisma.$transaction(async (prisma) => {
      const product = await prisma.product.create({
        data: {
          reference: createProductDto.reference,
          internalCode: createProductDto.internalCode,
          name: createProductDto.name,
          description: createProductDto.description,
          purchasePrice: createProductDto.purchasePrice,
          marginPercent: createProductDto.marginPercent,
          salePrice: createProductDto.salePrice,
          priceIncludingTax: createProductDto.priceIncludingTax,
          categoryId: createProductDto.categoryId,
          brandId: createProductDto.brandId,
          stock: initialStock,
          minStock: createProductDto.minStock || 0,
          discount: createProductDto.discount || 0,
          vat: createProductDto.vat || 19,
          fodec: createProductDto.fodec || 0,
          img: imageUrl,
          lastStockUpdate: initialStock > 0 ? new Date() : null,
        },
        include: {
          category: true,
          brand: true,
        },
      });

      return product;
    });
  }

  async update(
    id: number,
    updateProductDto: UpdateProductDto,
    imageUrl?: string,
    userId?: number,
  ) {
    const existingProduct = await this.findOne(id);
    const oldStock = existingProduct.stock;

    if (updateProductDto.reference) {
      const existing = await this.prisma.product.findFirst({
        where: {
          reference: updateProductDto.reference,
          id: { not: id },
        },
      });
      if (existing) {
        throw new BadRequestException(
          `Product with reference "${updateProductDto.reference}" already exists.`,
        );
      }
    }

    if (updateProductDto.internalCode) {
      const existing = await this.prisma.product.findFirst({
        where: {
          internalCode: updateProductDto.internalCode,
          id: { not: id },
        },
      });
      if (existing) {
        throw new BadRequestException(
          `Product with internal code "${updateProductDto.internalCode}" already exists.`,
        );
      }
    }

    if (updateProductDto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: updateProductDto.categoryId },
      });
      if (!category) {
        throw new BadRequestException(
          `Category with id ${updateProductDto.categoryId} not found.`,
        );
      }
    }

    if (updateProductDto.brandId) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: updateProductDto.brandId },
      });
      if (!brand) {
        throw new BadRequestException(
          `Brand with id ${updateProductDto.brandId} not found.`,
        );
      }
    }

    const updateData: any = { ...updateProductDto };
    if (imageUrl) {
      updateData.img = imageUrl;
    }

    const newStock = updateProductDto.stock;
    const stockChanged = newStock !== undefined && newStock !== oldStock;

    if (stockChanged) {
      return await this.prisma.$transaction(async (prisma) => {
        const updatedProduct = await prisma.product.update({
          where: { id },
          data: {
            ...updateData,
            lastStockUpdate: new Date(),
          },
          include: {
            category: true,
            brand: true,
          },
        });

        const quantityDifference = newStock - oldStock;
        const movementNumber = `ADJ-${Date.now()}-${id}`;

        await prisma.stockMovement.create({
          data: {
            movementNumber: movementNumber,
            type: 'ADJUSTMENT',
            quantity: Math.abs(quantityDifference),
            previousStock: oldStock,
            newStock: newStock,
            reason:
              quantityDifference > 0
                ? `Stock increased from ${oldStock} to ${newStock}`
                : `Stock decreased from ${oldStock} to ${newStock}`,
            reference: `Manual adjustment via product update - Product ID: ${id}`,
            status: 'COMPLETED',
            productId: id,
            createdAt: new Date(),
            createdBy: userId || 1,
            notes: `Stock manually adjusted during product update. Previous: ${oldStock}, New: ${newStock}`,
          },
        });

        return updatedProduct;
      });
    } else {
      if (Object.keys(updateData).length > 0) {
        return await this.prisma.product.update({
          where: { id },
          data: updateData,
          include: {
            category: true,
            brand: true,
          },
        });
      }
      return existingProduct;
    }
  }

  async findAll() {
    return await this.prisma.product.findMany({
      orderBy: { id: 'desc' },
      include: {
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
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        purchaseInvoiceItems: {
          include: {
            invoice: true,
          },
        },
        saleInvoiceItems: {
          include: {
            invoice: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found.`);
    }

    return product;
  }

  async findByReference(reference: string) {
    const product = await this.prisma.product.findFirst({
      where: { reference },
      include: {
        category: true,
        brand: true,
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with reference ${reference} not found.`,
      );
    }

    return product;
  }

  async remove(id: number) {
    const product = await this.findOne(id);

    if (
      (product.purchaseInvoiceItems &&
        product.purchaseInvoiceItems.length > 0) ||
      (product.saleInvoiceItems && product.saleInvoiceItems.length > 0)
    ) {
      throw new BadRequestException(
        'Cannot delete product with existing invoice items.',
      );
    }

    return await this.prisma.product.delete({
      where: { id },
    });
  }

  async updateStock(
    id: number,
    quantity: number,
    operation: 'increment' | 'decrement',
    userId?: number,
  ) {
    const product = await this.findOne(id);
    const oldStock = product.stock;

    const newStock =
      operation === 'increment'
        ? product.stock + quantity
        : product.stock - quantity;

    if (newStock < 0) {
      throw new BadRequestException('Insufficient stock.');
    }

    return await this.prisma.$transaction(async (prisma) => {
      const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
          stock: newStock,
          lastStockUpdate: new Date(),
        },
      });

      const movementNumber = `${operation === 'increment' ? 'INC' : 'DEC'}-${Date.now()}-${id}`;
      const movementType = operation === 'increment' ? 'INBOUND' : 'OUTBOUND';

      await prisma.stockMovement.create({
        data: {
          movementNumber: movementNumber,
          type: movementType,
          quantity: quantity,
          previousStock: oldStock,
          newStock: newStock,
          reason: `${operation === 'increment' ? 'Stock increased' : 'Stock decreased'} by ${quantity} units`,
          status: 'COMPLETED',
          productId: id,
          createdAt: new Date(),
          createdBy: userId || 1,
          notes: `Stock ${operation} operation. Quantity: ${quantity}`,
        },
      });

      return updatedProduct;
    });
  }

  async updateStockManually(
    id: number,
    newStock: number,
    reason: string,
    userId: number,
  ) {
    const product = await this.findOne(id);
    const oldStock = product.stock;

    if (newStock === oldStock) {
      throw new BadRequestException(
        'New stock value is the same as current stock.',
      );
    }

    if (newStock < 0) {
      throw new BadRequestException('Stock cannot be negative.');
    }

    const quantityDifference = newStock - oldStock;

    return await this.prisma.$transaction(async (prisma) => {
      const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
          stock: newStock,
          lastStockUpdate: new Date(),
        },
        include: {
          category: true,
          brand: true,
        },
      });

      const movementNumber = `ADJ-${Date.now()}-${id}`;

      await prisma.stockMovement.create({
        data: {
          movementNumber: movementNumber,
          type: 'ADJUSTMENT',
          quantity: Math.abs(quantityDifference),
          previousStock: oldStock,
          newStock: newStock,
          reason:
            reason || `Manual stock adjustment from ${oldStock} to ${newStock}`,
          reference: `Manual adjustment - ${reason || 'Stock correction'}`,
          status: 'COMPLETED',
          productId: id,
          createdAt: new Date(),
          createdBy: userId,
          notes: `Stock changed from ${oldStock} to ${newStock}`,
        },
      });

      return updatedProduct;
    });
  }

  async searchProducts(searchParams: SearchProductsDto) {
    const {
      search,
      brandNames,
      categoryNames,
      minPrice,
      maxPrice,
      page = 1,
      limit = 20,
      sortBy = 'id',
      sortOrder = 'desc',
    } = searchParams;

    const where: Prisma.ProductWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { internalCode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (brandNames) {
      const brandsArray = Array.isArray(brandNames) ? brandNames : [brandNames];
      where.brand = {
        name: { in: brandsArray, mode: 'insensitive' },
      };
    }

    if (categoryNames) {
      const categoriesArray = Array.isArray(categoryNames)
        ? categoryNames
        : [categoryNames];
      where.category = {
        name: { in: categoriesArray, mode: 'insensitive' },
      };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.salePrice = {};
      if (minPrice !== undefined) {
        where.salePrice.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.salePrice.lte = maxPrice;
      }
    }

    const skip = (page - 1) * limit;
    const take = limit;

    const totalCount = await this.prisma.product.count({ where });

    const products = await this.prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
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
    });

    return {
      products,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async getFilterOptions() {
    const brands = await this.prisma.brand.findMany({
      where: {
        isActive: true,
        products: {
          some: {},
        },
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const categories = await this.prisma.category.findMany({
      where: {
        products: {
          some: {},
        },
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    const priceAggregation = await this.prisma.product.aggregate({
      _min: {
        salePrice: true,
      },
      _max: {
        salePrice: true,
      },
    });

    return {
      brands: brands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        productCount: brand._count.products,
        img: brand.img,
      })),
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        productCount: category._count.products,
      })),
      priceRange: {
        minPrice: priceAggregation._min.salePrice || 0,
        maxPrice: priceAggregation._max.salePrice || 1000,
      },
    };
  }

  // ==================== PRODUCT CRAFT METHODS ====================

  async createProductCraft(
    data: CreateProductCraftDto,
    imageUrl?: string,
    userId: number = 1,
  ) {
    const result: any = {};

    return await this.prisma.$transaction(async (prisma) => {
      // Handle Product creation
      if (data.product) {
        if (data.product.reference) {
          const existingByRef = await prisma.product.findFirst({
            where: { reference: data.product.reference },
          });
          if (existingByRef) {
            throw new BadRequestException(
              `Product with reference "${data.product.reference}" already exists.`,
            );
          }
        }

        if (data.product.internalCode) {
          const existingByCode = await prisma.product.findFirst({
            where: { internalCode: data.product.internalCode },
          });
          if (existingByCode) {
            throw new BadRequestException(
              `Product with internal code "${data.product.internalCode}" already exists.`,
            );
          }
        }

        const category = await prisma.category.findUnique({
          where: { id: data.product.categoryId },
        });
        if (!category) {
          throw new BadRequestException(
            `Category with id ${data.product.categoryId} not found.`,
          );
        }

        const product = await prisma.product.create({
          data: {
            ...data.product,
            img: imageUrl || data.product.img,
            lastStockUpdate: (data.product.stock || 0) > 0 ? new Date() : null,
          },
          include: {
            category: true,
            brand: true,
          },
        });

        result.product = product;
      }

      // Handle CraftProduct creation
      if (data.craftProduct) {
        if (data.craftProduct.reference) {
          const existingByRef = await prisma.craftProduct.findFirst({
            where: { reference: data.craftProduct.reference },
          });
          if (existingByRef) {
            throw new BadRequestException(
              `CraftProduct with reference "${data.craftProduct.reference}" already exists.`,
            );
          }
        }

        const craftProductData = { ...data.craftProduct };
        delete (craftProductData as any).materials;
        delete (craftProductData as any).serviceIds;

        const craftProduct = await prisma.craftProduct.create({
          data: {
            ...craftProductData,
            img: imageUrl || craftProductData.img,
            productId:
              data.craftProduct.productId || result.product?.id || null,
          },
        });

        if (
          data.craftProduct.materials &&
          data.craftProduct.materials.length > 0
        ) {
          for (const material of data.craftProduct.materials) {
            const rawMaterial = await prisma.rawMaterial.findUnique({
              where: { id: material.rawMaterialId },
            });
            if (!rawMaterial) {
              throw new BadRequestException(
                `Raw material with id ${material.rawMaterialId} not found`,
              );
            }

            await prisma.craftProductMaterial.create({
              data: {
                craftProductId: craftProduct.id,
                rawMaterialId: material.rawMaterialId,
                amount: material.amount,
              },
            });
          }
        }

        if (
          data.craftProduct.serviceIds &&
          data.craftProduct.serviceIds.length > 0
        ) {
          for (const serviceId of data.craftProduct.serviceIds) {
            const serviceExists = await prisma.service.findUnique({
              where: { id: serviceId },
            });
            if (!serviceExists) {
              throw new BadRequestException(
                `Service with id ${serviceId} not found`,
              );
            }

            await prisma.craftProductService.create({
              data: {
                craftProductId: craftProduct.id,
                serviceId: serviceId,
              },
            });
          }
        }

        const completeCraftProduct = await prisma.craftProduct.findUnique({
          where: { id: craftProduct.id },
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
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
          },
        });

        result.craftProduct = completeCraftProduct;
      }

      return result;
    });
  }

  // src/products/products.service.ts

  async updateProductCraft(
    id: number, // This is now the PRODUCT ID
    data: UpdateProductCraftDto,
    imageUrl?: string,
    userId: number = 1,
  ) {
    const result: any = {};

    return await this.prisma.$transaction(async (prisma) => {
      // First, find the product by ID
      const existingProduct = await prisma.product.findUnique({
        where: { id: id },
        include: {
          category: true,
          brand: true,
        },
      });

      if (!existingProduct) {
        throw new NotFoundException(`Product with id ${id} not found`);
      }

      // Check if this product is linked to a craft product
      const existingCraftProduct = await prisma.craftProduct.findFirst({
        where: {
          productId: id,
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
        },
      });

      // Handle Product update
      if (data.product) {
        // Check reference uniqueness
        if (data.product.reference) {
          const existing = await prisma.product.findFirst({
            where: {
              reference: data.product.reference,
              id: { not: id },
            },
          });
          if (existing) {
            throw new BadRequestException(
              `Product with reference "${data.product.reference}" already exists.`,
            );
          }
        }

        // Check internal code uniqueness
        if (data.product.internalCode) {
          const existing = await prisma.product.findFirst({
            where: {
              internalCode: data.product.internalCode,
              id: { not: id },
            },
          });
          if (existing) {
            throw new BadRequestException(
              `Product with internal code "${data.product.internalCode}" already exists.`,
            );
          }
        }

        const updateData = { ...data.product };

        const updatedProduct = await prisma.product.update({
          where: { id: id },
          data: {
            ...updateData,
            img: imageUrl || updateData.img,
            lastStockUpdate:
              updateData.stock !== undefined &&
              updateData.stock !== existingProduct.stock
                ? new Date()
                : undefined,
          },
          include: {
            category: true,
            brand: true,
          },
        });

        // Create stock movement if stock changed
        if (
          updateData.stock !== undefined &&
          updateData.stock !== existingProduct.stock
        ) {
          const oldStock = existingProduct.stock;
          const newStock = updateData.stock;
          const quantityDifference = newStock - oldStock;
          const movementNumber = `ADJ-${Date.now()}-${updatedProduct.id}`;

          await prisma.stockMovement.create({
            data: {
              movementNumber: movementNumber,
              type: 'ADJUSTMENT',
              quantity: Math.abs(quantityDifference),
              previousStock: oldStock,
              newStock: newStock,
              reason:
                quantityDifference > 0
                  ? `Stock increased from ${oldStock} to ${newStock}`
                  : `Stock decreased from ${oldStock} to ${newStock}`,
              reference: `Manual adjustment via API`,
              status: 'COMPLETED',
              productId: updatedProduct.id,
              createdAt: new Date(),
              createdBy: userId,
              notes: `Stock manually adjusted during product update. Previous: ${oldStock}, New: ${newStock}`,
            },
          });
        }

        result.product = updatedProduct;
      }

      // Handle CraftProduct update if it exists
      if (existingCraftProduct) {
        // Only update craft product if craftProduct data is provided
        if (data.craftProduct) {
          // Check reference uniqueness
          if (data.craftProduct.reference) {
            const existing = await prisma.craftProduct.findFirst({
              where: {
                reference: data.craftProduct.reference,
                id: { not: existingCraftProduct.id },
              },
            });
            if (existing) {
              throw new BadRequestException(
                `CraftProduct with reference "${data.craftProduct.reference}" already exists.`,
              );
            }
          }

          const craftUpdateData = { ...data.craftProduct };
          delete (craftUpdateData as any).materials;
          delete (craftUpdateData as any).serviceIds;

          await prisma.craftProduct.update({
            where: { id: existingCraftProduct.id },
            data: {
              ...craftUpdateData,
              img: imageUrl || craftUpdateData.img,
            },
          });

          // Update materials if provided
          if (data.craftProduct.materials) {
            await prisma.craftProductMaterial.deleteMany({
              where: { craftProductId: existingCraftProduct.id },
            });

            for (const material of data.craftProduct.materials) {
              const rawMaterial = await prisma.rawMaterial.findUnique({
                where: { id: material.rawMaterialId },
              });
              if (!rawMaterial) {
                throw new BadRequestException(
                  `Raw material with id ${material.rawMaterialId} not found`,
                );
              }

              await prisma.craftProductMaterial.create({
                data: {
                  craftProductId: existingCraftProduct.id,
                  rawMaterialId: material.rawMaterialId,
                  amount: material.amount,
                },
              });
            }
          }

          // Update services if provided
          if (data.craftProduct.serviceIds) {
            await prisma.craftProductService.deleteMany({
              where: { craftProductId: existingCraftProduct.id },
            });

            for (const serviceId of data.craftProduct.serviceIds) {
              const serviceExists = await prisma.service.findUnique({
                where: { id: serviceId },
              });
              if (!serviceExists) {
                throw new BadRequestException(
                  `Service with id ${serviceId} not found`,
                );
              }

              await prisma.craftProductService.create({
                data: {
                  craftProductId: existingCraftProduct.id,
                  serviceId: serviceId,
                },
              });
            }
          }
        }

        // Fetch the complete updated craft product with all relations
        const completeCraftProduct = await prisma.craftProduct.findUnique({
          where: { id: existingCraftProduct.id },
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
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
          },
        });

        result.craftProduct = completeCraftProduct;
      } else {
        // If no craft product exists but craftProduct data is provided, create it
        if (data.craftProduct) {
          // Check reference uniqueness
          if (data.craftProduct.reference) {
            const existing = await prisma.craftProduct.findFirst({
              where: {
                reference: data.craftProduct.reference,
              },
            });
            if (existing) {
              throw new BadRequestException(
                `CraftProduct with reference "${data.craftProduct.reference}" already exists.`,
              );
            }
          }

          const craftCreateData = { ...data.craftProduct };
          delete (craftCreateData as any).materials;
          delete (craftCreateData as any).serviceIds;

          const newCraftProduct = await prisma.craftProduct.create({
            data: {
              ...craftCreateData,
              img: imageUrl || craftCreateData.img,
              productId: id, // Link to the product
            },
          });

          // Add materials if provided
          if (data.craftProduct.materials) {
            for (const material of data.craftProduct.materials) {
              const rawMaterial = await prisma.rawMaterial.findUnique({
                where: { id: material.rawMaterialId },
              });
              if (!rawMaterial) {
                throw new BadRequestException(
                  `Raw material with id ${material.rawMaterialId} not found`,
                );
              }

              await prisma.craftProductMaterial.create({
                data: {
                  craftProductId: newCraftProduct.id,
                  rawMaterialId: material.rawMaterialId,
                  amount: material.amount,
                },
              });
            }
          }

          // Add services if provided
          if (data.craftProduct.serviceIds) {
            for (const serviceId of data.craftProduct.serviceIds) {
              const serviceExists = await prisma.service.findUnique({
                where: { id: serviceId },
              });
              if (!serviceExists) {
                throw new BadRequestException(
                  `Service with id ${serviceId} not found`,
                );
              }

              await prisma.craftProductService.create({
                data: {
                  craftProductId: newCraftProduct.id,
                  serviceId: serviceId,
                },
              });
            }
          }

          // Fetch the complete craft product with all relations
          const completeCraftProduct = await prisma.craftProduct.findUnique({
            where: { id: newCraftProduct.id },
            include: {
              product: {
                include: {
                  category: true,
                  brand: true,
                },
              },
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
            },
          });

          result.craftProduct = completeCraftProduct;
        } else {
          // No craft product exists and no craft data provided
          result.craftProduct = null;
        }
      }

      return result;
    });
  }

  async getProductWithCraft(id: number) {
    // First, get the product
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found.`);
    }

    // Check if this product is linked to a craft product
    const craftProduct = await this.prisma.craftProduct.findFirst({
      where: {
        productId: id,
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
      },
    });

    // Return both product and craft product (if exists)
    return {
      product,
      craftProduct: craftProduct || null,
    };
  }
}
