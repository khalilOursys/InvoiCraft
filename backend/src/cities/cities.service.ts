import { Injectable } from '@nestjs/common';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class CitiesService {
  constructor(private prisma: PrismaService) {}
  tunisianCities = [
    'Tunis',
    'Ariana',
    'Ben Arous',
    'Manouba',
    'Nabeul',
    'Zaghouan',
    'Bizerte',
    'Beja',
    'Jendouba',
    'Kef',
    'Siliana',
    'Sousse',
    'Monastir',
    'Mahdia',
    'Sfax',
    'Kairouan',
    'Kasserine',
    'Sidi Bouzid',
    'Gabes',
    'Médenine',
    'Tataouine',
    'Gafsa',
    'Tozeur',
    'Kebili',
    'Djerba',
  ];
  async onModuleInit() {
    for (const city of this.tunisianCities) {
      const existingCity = await this.prisma.city.findFirst({
        where: {
          name: city,
          country: 'Tunisia',
        },
      });

      if (existingCity) {
        await this.prisma.city.update({
          where: { id: existingCity.id },
          data: { isActive: true },
        });
      } else {
        await this.prisma.city.create({
          data: {
            name: city,
            country: 'Tunisia',
          },
        });
      }
    }
  }
  async findAll() {
    return this.prisma.city.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
