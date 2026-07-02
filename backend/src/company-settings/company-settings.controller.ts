import {
  Controller,
  Put,
  Get,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CompanySettingsService } from './company-settings.service';
import { UpdateCompanySettingsDto } from './dto/update-company-setting.dto';
import { companyLogoMulter } from 'src/config/multer.config';

@Controller('company-settings')
export class CompanySettingsController {
  constructor(private readonly service: CompanySettingsService) {}

  @Get()
  getCompany() {
    return this.service.get();
  }

  @Put()
  @UseInterceptors(FileInterceptor('logo', companyLogoMulter))
  updateAll(
    @Body() body: UpdateCompanySettingsDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.updateAll(body, file?.filename);
  }
}
