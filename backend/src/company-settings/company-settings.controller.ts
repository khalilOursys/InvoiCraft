// company-settings.controller.ts
import {
  Controller,
  Put,
  Get,
  Post,
  Delete,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CompanySettingsService } from './company-settings.service';
import { UpdateCompanySettingsDto } from './dto/update-company-setting.dto';
import { companyLogoMulter } from '../config/multer.config';

@Controller('company-settings')
export class CompanySettingsController {
  constructor(private readonly service: CompanySettingsService) {}

  @Get()
  getCompany() {
    return this.service.get();
  }

  // API 1: Update profile information (without logo)
  @Put()
  updateProfile(@Body() body: UpdateCompanySettingsDto) {
    return this.service.updateProfile(body);
  }

  // API 2: Upload/Update logo only
  @Post('logo')
  @UseInterceptors(FileInterceptor('logo', companyLogoMulter))
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    return this.service.uploadLogo(file.filename);
  }

  // API 3: Delete logo
  @Delete('logo')
  deleteLogo() {
    return this.service.deleteLogo();
  }
}
