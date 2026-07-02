import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateHeroBannerDto } from './dto/create-hero-banner.dto';
import { UpdateHeroBannerDto } from './dto/update-hero-banner.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class HeroBannerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createHeroBannerDto: CreateHeroBannerDto) {
    return await this.prisma.heroBanner.create({
      data: createHeroBannerDto,
    });
  }

  async findAll() {
    return await this.prisma.heroBanner.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const heroBanner = await this.prisma.heroBanner.findUnique({
      where: { id },
    });
    if (!heroBanner) {
      throw new NotFoundException(`HeroBanner with id ${id} not found.`);
    }
    return heroBanner;
  }

  async update(id: number, updateHeroBannerDto: UpdateHeroBannerDto) {
    // Ensure the heroBanner exists before updating
    await this.findOne(id);
    return await this.prisma.heroBanner.update({
      where: { id },
      data: updateHeroBannerDto,
    });
  }

  async remove(id: number) {
    // Ensure the heroBanner exists before deletion
    await this.findOne(id);
    return await this.prisma.heroBanner.delete({
      where: { id },
    });
  }

  async toggleStatus(id: number) {
    try {
      const heroBanner = await this.prisma.heroBanner.findUnique({
        where: { id },
      });

      if (!heroBanner) {
        return { success: false, status: HttpStatus.NOT_FOUND };
      }

      const updatedHeroBanner = await this.prisma.heroBanner.update({
        where: { id },
        data: { isActive: !heroBanner.isActive },
      });

      return {
        success: true,
        status: HttpStatus.OK,
        isActive: updatedHeroBanner.isActive, // Return new status
      };
    } catch (error) {
      return { success: false, status: HttpStatus.FORBIDDEN };
    }
  }

  async getIsActived() {
    return await this.prisma.heroBanner.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
