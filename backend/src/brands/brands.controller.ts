import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
} from '@nestjs/common';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { multerConfigBrands } from 'src/config/multer.config';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}
  @Post('upload')
  @UseInterceptors(FileInterceptor('image', multerConfigBrands))
  async uploadImages(@UploadedFile() file: Express.Multer.File) {
    //change hostUrl with .env after meet with client
    const hostUrl = process.env.imagePath || 'https://api.brooklyn-store.tn';

    // Create an array of product images to be saved
    const imageUrl = `${hostUrl}/${file.path.replace(/\\/g, '/')}`;

    return { url: imageUrl };
  }
  @Post()
  async create(@Body() createBrandDto: CreateBrandDto) {
    return await this.brandsService.create(createBrandDto);
  }

  @Get()
  async findAll() {
    return await this.brandsService.findAll();
  }

  @Get('getBrandById/:id')
  async findOne(@Param('id') id: number) {
    return await this.brandsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() updateBrandDto: UpdateBrandDto,
  ) {
    return await this.brandsService.update(id, updateBrandDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: number) {
    return await this.brandsService.remove(id);
  }

  @Get('getIsActived')
  async getIsActived() {
    return await this.brandsService.getIsActived();
  }
}
