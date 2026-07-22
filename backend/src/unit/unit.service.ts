// src/unit/unit.service.ts

import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitService {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultUnits();
  }
  async getAllUnits() {
    return this.prisma.unit.findMany({
      where: { isActive: true },
      include: {
        baseUnit: true,
        subUnits: true,
      },
      orderBy: [{ family: 'asc' }, { code: 'asc' }],
    });
  }

  async getUnitsByFamily(family: string) {
    return this.prisma.unit.findMany({
      where: {
        family,
        isActive: true,
      },
      include: {
        baseUnit: true,
        subUnits: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  async getUnitById(id: number) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        baseUnit: true,
        subUnits: true,
      },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    return unit;
  }

  async getUnitByCode(code: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { code },
      include: {
        baseUnit: true,
        subUnits: true,
      },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with code ${code} not found`);
    }

    return unit;
  }

  async getBaseUnitForUnit(unitId: number) {
    const unit = await this.getUnitById(unitId);

    if (unit.baseUnitId) {
      return this.getUnitById(unit.baseUnitId);
    }

    return unit;
  }

  async getSubUnitsForUnit(unitId: number) {
    const unit = await this.getUnitById(unitId);
    return unit.subUnits || [];
  }

  async createUnit(data: CreateUnitDto) {
    // Check if code already exists
    const existing = await this.prisma.unit.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new ConflictException(`Unit with code ${data.code} already exists`);
    }

    // Validate base unit if provided
    if (data.baseUnitId) {
      const baseUnit = await this.prisma.unit.findUnique({
        where: { id: data.baseUnitId },
      });

      if (!baseUnit) {
        throw new NotFoundException(
          `Base unit with ID ${data.baseUnitId} not found`,
        );
      }

      // Ensure base unit doesn't have a base unit itself
      if (baseUnit.baseUnitId) {
        throw new ConflictException('Cannot use a sub-unit as a base unit');
      }
    }

    return this.prisma.unit.create({
      data: {
        code: data.code,
        name: data.name,
        symbol: data.symbol,
        family: data.family,
        baseUnitId: data.baseUnitId,
        conversionToBase: data.conversionToBase,
        description: data.description,
        isStandard: data.isStandard || false,
      },
      include: {
        baseUnit: true,
        subUnits: true,
      },
    });
  }

  async updateUnit(id: number, data: UpdateUnitDto) {
    await this.getUnitById(id);

    // Check if code is being changed and if it already exists
    if (data.code) {
      const existing = await this.prisma.unit.findFirst({
        where: {
          code: data.code,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Unit with code ${data.code} already exists`,
        );
      }
    }

    // Validate base unit if provided
    if (data.baseUnitId) {
      const baseUnit = await this.prisma.unit.findUnique({
        where: { id: data.baseUnitId },
      });

      if (!baseUnit) {
        throw new NotFoundException(
          `Base unit with ID ${data.baseUnitId} not found`,
        );
      }

      if (baseUnit.baseUnitId) {
        throw new ConflictException('Cannot use a sub-unit as a base unit');
      }
    }

    return this.prisma.unit.update({
      where: { id },
      data: {
        code: data.code,
        name: data.name,
        symbol: data.symbol,
        family: data.family,
        baseUnitId: data.baseUnitId,
        conversionToBase: data.conversionToBase,
        description: data.description,
        isActive: true,
      },
      include: {
        baseUnit: true,
        subUnits: true,
      },
    });
  }

  async deleteUnit(id: number) {
    await this.getUnitById(id);

    // Check if unit is being used
    const isUsed = await this.prisma.$transaction(async (prisma) => {
      const rawMaterials = await prisma.rawMaterial.count({
        where: { unitId: id },
      });
      const craftProducts = await prisma.craftProduct.count({
        where: { unitId: id },
      });
      const productionOrders = await prisma.productionOrder.count({
        where: { unitId: id },
      });

      return rawMaterials > 0 || craftProducts > 0 || productionOrders > 0;
    });

    if (isUsed) {
      throw new ConflictException('Cannot delete unit as it is being used');
    }

    // Soft delete
    return this.prisma.unit.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async seedDefaultUnits() {
    const defaultUnits = [
      // Volume units (base: L)
      {
        code: 'L',
        name: 'Liter',
        symbol: 'L',
        family: 'volume',
        conversionToBase: 1,
        isStandard: true,
        description: 'Base unit for volume',
      },
      {
        code: 'ml',
        name: 'Milliliter',
        symbol: 'ml',
        family: 'volume',
        baseUnitCode: 'L',
        conversionToBase: 0.001,
        isStandard: true,
        description: 'Sub-unit of Liter',
      },
      {
        code: 'cl',
        name: 'Centiliter',
        symbol: 'cl',
        family: 'volume',
        baseUnitCode: 'L',
        conversionToBase: 0.01,
        isStandard: true,
        description: 'Sub-unit of Liter',
      },
      {
        code: 'dl',
        name: 'Deciliter',
        symbol: 'dl',
        family: 'volume',
        baseUnitCode: 'L',
        conversionToBase: 0.1,
        isStandard: true,
        description: 'Sub-unit of Liter',
      },
      {
        code: 'm3',
        name: 'Cubic Meter',
        symbol: 'm³',
        family: 'volume',
        baseUnitCode: 'L',
        conversionToBase: 1000,
        isStandard: true,
        description: 'Sub-unit of Liter',
      },

      // Weight units (base: g)
      {
        code: 'g',
        name: 'Gram',
        symbol: 'g',
        family: 'weight',
        conversionToBase: 1,
        isStandard: true,
        description: 'Base unit for weight',
      },
      {
        code: 'kg',
        name: 'Kilogram',
        symbol: 'kg',
        family: 'weight',
        baseUnitCode: 'g',
        conversionToBase: 1000,
        isStandard: true,
        description: 'Sub-unit of Gram',
      },
      {
        code: 'mg',
        name: 'Milligram',
        symbol: 'mg',
        family: 'weight',
        baseUnitCode: 'g',
        conversionToBase: 0.001,
        isStandard: true,
        description: 'Sub-unit of Gram',
      },
      {
        code: 'lb',
        name: 'Pound',
        symbol: 'lb',
        family: 'weight',
        baseUnitCode: 'g',
        conversionToBase: 453.592,
        isStandard: true,
        description: 'Sub-unit of Gram',
      },
      {
        code: 'oz',
        name: 'Ounce',
        symbol: 'oz',
        family: 'weight',
        baseUnitCode: 'g',
        conversionToBase: 28.3495,
        isStandard: true,
        description: 'Sub-unit of Gram',
      },

      // Unit (pieces)
      {
        code: 'unit',
        name: 'Unit',
        symbol: 'unit',
        family: 'unit',
        conversionToBase: 1,
        isStandard: true,
        description: 'Base unit for pieces',
      },
      {
        code: 'piece',
        name: 'Piece',
        symbol: 'pc',
        family: 'unit',
        baseUnitCode: 'unit',
        conversionToBase: 1,
        isStandard: true,
        description: 'Sub-unit of Unit',
      },
      {
        code: 'pcs',
        name: 'Pieces',
        symbol: 'pcs',
        family: 'unit',
        baseUnitCode: 'unit',
        conversionToBase: 1,
        isStandard: true,
        description: 'Sub-unit of Unit',
      },
    ];

    for (const unitData of defaultUnits) {
      const existing = await this.prisma.unit.findUnique({
        where: { code: unitData.code },
      });

      if (!existing) {
        const { baseUnitCode, ...data } = unitData;
        let baseUnitId: number | undefined;

        if (baseUnitCode) {
          const baseUnit = await this.prisma.unit.findUnique({
            where: { code: baseUnitCode },
          });
          if (baseUnit) {
            baseUnitId = baseUnit.id;
          }
        }

        await this.prisma.unit.create({
          data: {
            ...data,
            baseUnitId,
          },
        });
      }
    }
  }

  async getUnitFamilies() {
    const units = await this.prisma.unit.findMany({
      where: { isActive: true },
      select: { family: true },
      distinct: ['family'],
    });
    return units.map((u) => u.family);
  }
}
