// src/raw-material/raw-material.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto';

@Injectable()
export class RawMaterialService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateRawMaterialDto) {
    return this.prisma.rawMaterial.create({
      data,
    });
  }

  async findAll() {
    return this.prisma.rawMaterial.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const material = await this.prisma.rawMaterial.findUnique({
      where: { id },
    });

    if (!material) {
      throw new NotFoundException(`Raw material with ID ${id} not found`);
    }

    return material;
  }

  async update(id: number, data: UpdateRawMaterialDto) {
    await this.findOne(id);

    return this.prisma.rawMaterial.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.rawMaterial.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async restock(id: number, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const material = await this.findOne(id);

    return this.prisma.rawMaterial.update({
      where: { id },
      data: {
        amount: {
          increment: amount,
        },
      },
    });
  }

  async consumeStock(id: number, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const material = await this.findOne(id);

    if (material.amount < amount) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${material.amount}${material.unit}, Required: ${amount}${material.unit}`,
      );
    }

    return this.prisma.rawMaterial.update({
      where: { id },
      data: {
        amount: {
          decrement: amount,
        },
      },
    });
  }
}
