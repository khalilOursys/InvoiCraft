import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBrandDto: CreateBrandDto) {
    // Check if a brand with the same name already exists
    const existing = await this.prisma.brand.findUnique({
      where: { name: createBrandDto.name },
    });
    if (existing) {
      throw new BadRequestException(
        `Brand with name "${createBrandDto.name}" already exists.`,
      );
    }
    return await this.prisma.brand.create({
      data: createBrandDto,
    });
  }

  async findAll() {
    return await this.prisma.brand.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getIsActived() {
    return await this.prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) {
      throw new NotFoundException(`Brand with id ${id} not found.`);
    }
    return brand;
  }

  async update(id: number, updateBrandDto: UpdateBrandDto) {
    // Ensure the brand exists before updating
    await this.findOne(id);
    return await this.prisma.brand.update({
      where: { id },
      data: updateBrandDto,
    });
  }

  async remove(id: number) {
    // Ensure the brand exists before deletion
    await this.findOne(id);
    return await this.prisma.brand.delete({
      where: { id },
    });
  }
}
