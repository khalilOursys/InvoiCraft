// src/products/products.controller.ts
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { multerConfigProducts } from '../config/multer.config';
import { SearchProductsDto } from './dto/search-products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image', multerConfigProducts))
  async create(
    @Body() createProductDto: CreateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    try {
      // Handle image upload if provided
      let imageUrl: string | undefined;

      if (file) {
        const hostUrl =
          process.env.imagePath || 'https://api.brooklyn-store.tn';
        // Normalize path for URL (replace backslashes with forward slashes)
        const normalizedPath = file.path.replace(/\\/g, '/');
        imageUrl = `${hostUrl}/${normalizedPath}`;
      }

      return await this.productsService.create(createProductDto, imageUrl);
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  async findAll() {
    return await this.productsService.findAll();
  }

  @Get('search')
  async searchProducts(
    @Query(new ValidationPipe({ transform: true }))
    searchParams: SearchProductsDto,
  ) {
    return await this.productsService.searchProducts(searchParams);
  }

  @Get('filter-options')
  async getFilterOptions() {
    return await this.productsService.getFilterOptions();
  }
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.productsService.findOne(id);
  }

  @Get('reference/:reference')
  async findByReference(@Param('reference') reference: string) {
    return await this.productsService.findByReference(reference);
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('image', multerConfigProducts))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    try {
      let imageUrl: string | undefined;

      if (file) {
        const hostUrl =
          process.env.imagePath || 'https://api.brooklyn-store.tn';
        const normalizedPath = file.path.replace(/\\/g, '/');
        imageUrl = `${hostUrl}/${normalizedPath}`;
      }

      return await this.productsService.update(id, updateProductDto, imageUrl);
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.productsService.remove(id);
  }

  @Put('stock/:id/:operation')
  async updateStock(
    @Param('id', ParseIntPipe) id: number,
    @Param('operation') operation: 'increment' | 'decrement',
    @Body('quantity', ParseIntPipe) quantity: number,
  ) {
    return await this.productsService.updateStock(id, quantity, operation);
  }
}
