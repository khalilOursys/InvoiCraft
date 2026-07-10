// company-settings.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanySettingsDto } from './dto/update-company-setting.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CompanySettingsService {
  constructor(private prisma: PrismaService) {}

  async get() {
    const settings = await this.prisma.companySettings.findFirst();
    if (!settings) {
      // Return empty settings if none exist
      return {
        id: null,
        companyName: '',
        address: '',
        phone: '',
        taxNumber: '',
        rib: '',
        email: '',
        logo: '',
        createdAt: null,
        updatedAt: null,
      };
    }
    return settings;
  }

  // API 1: Update profile information only (no logo)
  async updateProfile(dto: UpdateCompanySettingsDto) {
    const settings = await this.prisma.companySettings.findFirst();

    // Prepare data - only include fields that are provided
    const data: any = {};
    if (dto.companyName !== undefined) data.companyName = dto.companyName;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.taxNumber !== undefined) data.taxNumber = dto.taxNumber;
    if (dto.rib !== undefined) data.rib = dto.rib;
    if (dto.email !== undefined) data.email = dto.email;

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

  // API 2: Upload/Update logo only
  async uploadLogo(filename: string) {
    const settings = await this.prisma.companySettings.findFirst();

    // Delete old logo if it exists
    if (settings?.logo) {
      const oldLogoPath = path.join(
        process.cwd(),
        'uploads',
        'logos',
        settings.logo,
      );
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    const data = { logo: filename };

    if (!settings) {
      // If no settings exist, create with just logo and empty other fields
      const created = await this.prisma.companySettings.create({
        data: {
          logo: filename,
          companyName: '',
          address: '',
          phone: '',
          taxNumber: '',
          rib: '',
          email: '',
        },
      });
      return { logo: created.logo };
    }

    const updated = await this.prisma.companySettings.update({
      where: { id: settings.id },
      data,
    });

    return { logo: updated.logo };
  }

  // API 3: Delete logo
  async deleteLogo() {
    const settings = await this.prisma.companySettings.findFirst();

    if (!settings || !settings.logo) {
      throw new NotFoundException('No logo found to delete');
    }

    // Delete the physical file
    const logoPath = path.join(
      process.cwd(),
      'uploads',
      'logos',
      settings.logo,
    );
    if (fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
    }

    // Update database - remove logo
    const updated = await this.prisma.companySettings.update({
      where: { id: settings.id },
      data: { logo: '' },
    });

    return { message: 'Logo deleted successfully', logo: updated.logo };
  }
}
