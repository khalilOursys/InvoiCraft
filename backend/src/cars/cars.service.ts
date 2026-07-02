import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';

@Injectable()
export class CarsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCarDto) {
    return await this.prisma.car.create({
      data: dto,
    });
  }

  async findAll() {
    return this.prisma.car.findMany({
      include: { driver: true },
    });
  }

  async findOne(id: number) {
    const car = await this.prisma.car.findUnique({
      where: { id },
      include: { driver: true },
    });

    if (!car) throw new NotFoundException('Car not found');
    return car;
  }

  async update(id: number, dto: UpdateCarDto) {
    return this.prisma.car.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    return this.prisma.car.delete({ where: { id } });
  }
}
