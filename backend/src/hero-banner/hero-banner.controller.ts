import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Put,
} from '@nestjs/common';
import { HeroBannerService } from './hero-banner.service';
import { CreateHeroBannerDto } from './dto/create-hero-banner.dto';
import { UpdateHeroBannerDto } from './dto/update-hero-banner.dto';
import { multerConfigHeroBanner } from 'src/config/multer.config';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('hero-banner')
export class HeroBannerController {
  constructor(private readonly heroBannersService: HeroBannerService) {}
  @Post('upload')
  @UseInterceptors(FileInterceptor('image', multerConfigHeroBanner))
  async uploadImages(@UploadedFile() file: Express.Multer.File) {
    //change hostUrl with .env after meet with client
    const hostUrl = process.env.imagePath || 'https://api.brooklyn-store.tn';

    // Create an array of product images to be saved
    const imageUrl = `${hostUrl}/${file.path.replace(/\\/g, '/')}`;

    return { url: imageUrl };
  }
  @Post()
  async create(@Body() createHeroBannerDto: CreateHeroBannerDto) {
    return await this.heroBannersService.create(createHeroBannerDto);
  }

  @Get()
  async findAll() {
    return await this.heroBannersService.findAll();
  }

  @Get('getHeroBannerById/:id')
  async findOne(@Param('id') id: number) {
    return await this.heroBannersService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() updateHeroBannerDto: UpdateHeroBannerDto,
  ) {
    return await this.heroBannersService.update(id, updateHeroBannerDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: number) {
    return await this.heroBannersService.remove(id);
  }

  @Put('toggle-status/:id')
  async toggleStatus(@Param('id') id: number) {
    const result = await this.heroBannersService.toggleStatus(id);
    return {
      success: result.success,
      isActive: result.isActive,
      statusCode: result.status,
    };
  }

  @Get('getIsActived')
  async getIsActived() {
    return await this.heroBannersService.getIsActived();
  }
}
