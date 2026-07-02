import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanySettingsDto } from './dto/update-company-setting.dto';

@Injectable()
export class CompanySettingsService {
  constructor(private prisma: PrismaService) {}

  async updateAll(dto: UpdateCompanySettingsDto, logo?: string) {
    const settings = await this.prisma.companySettings.findFirst();

    const data = {
      companyName: dto.companyName,
      address: dto.address,
      phone: dto.phone,
      taxNumber: dto.taxNumber,
      rib: dto.rib,
      email: dto.email,
      ...(logo && { logo }),
    };

    if (!settings) {
      return this.prisma.companySettings.create({
        data,
      });
    }

    return this.prisma.companySettings.update({
      where: { id: settings.id },
      data,
    });
  }

  get() {
    return this.prisma.companySettings.findFirst();
  }
}
