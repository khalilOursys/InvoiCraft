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
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductCraftDto } from './dto/create-product-craft.dto';
import { UpdateProductCraftDto } from './dto/update-product-craft.dto';
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
      let imageUrl: string | undefined;

      if (file) {
        const hostUrl =
          process.env.imagePath || 'https://api.brooklyn-store.tn';
        const normalizedPath = file.path.replace(/\\/g, '/');
        imageUrl = `${hostUrl}/${normalizedPath}`;
      }

      return await this.productsService.create(createProductDto, imageUrl);
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('product-craft')
  @UseInterceptors(FileInterceptor('image', multerConfigProducts))
  async createProductCraft(
    @Body() body: any,
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

      // Parse JSON strings from form-data
      let productData = body.product;
      let craftProductData = body.craftProduct;

      if (productData && typeof productData === 'string') {
        try {
          productData = JSON.parse(productData);
        } catch (e) {
          throw new BadRequestException('Invalid product JSON format');
        }
      }

      if (craftProductData && typeof craftProductData === 'string') {
        try {
          craftProductData = JSON.parse(craftProductData);
        } catch (e) {
          throw new BadRequestException('Invalid craftProduct JSON format');
        }
      }

      // Create DTO instance
      const createDto = new CreateProductCraftDto();
      createDto.product = productData;
      createDto.craftProduct = craftProductData;
      createDto.createLinkedProduct =
        body.createLinkedProduct === 'true' ||
        body.createLinkedProduct === '1' ||
        body.createLinkedProduct === true;

      if (!createDto.product && !createDto.craftProduct) {
        throw new BadRequestException(
          'At least one of product or craftProduct must be provided',
        );
      }

      return await this.productsService.createProductCraft(createDto, imageUrl);
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

  @Put('product-craft/:id')
  @UseInterceptors(FileInterceptor('image', multerConfigProducts))
  async updateProductCraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
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

      // Parse JSON strings from form-data
      let productData = body.product;
      let craftProductData = body.craftProduct;

      if (productData && typeof productData === 'string') {
        try {
          productData = JSON.parse(productData);
        } catch (e) {
          throw new BadRequestException('Invalid product JSON format');
        }
      }

      if (craftProductData && typeof craftProductData === 'string') {
        try {
          craftProductData = JSON.parse(craftProductData);
        } catch (e) {
          throw new BadRequestException('Invalid craftProduct JSON format');
        }
      }

      const updateDto = new UpdateProductCraftDto();
      updateDto.product = productData;
      updateDto.craftProduct = craftProductData;

      if (!updateDto.product && !updateDto.craftProduct) {
        throw new BadRequestException(
          'At least one of product or craftProduct must be provided',
        );
      }

      return await this.productsService.updateProductCraft(
        id,
        updateDto,
        imageUrl,
      );
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

  // Get product with craft product
  @Get('product-craft/:id')
  async getProductWithCraft(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.productsService.getProductWithCraft(id);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
