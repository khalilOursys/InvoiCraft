// src/craft-product/craft-product.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CraftProductService } from './craft-product.service';
import {
  CreateCraftProductDto,
  SellCraftProductDto,
  UpdateStockDto,
} from './dto/create-craft-product.dto';
import { UpdateCraftProductDto } from './dto/update-craft-product.dto';

@Controller('craft-products')
export class CraftProductController {
  constructor(private readonly craftProductService: CraftProductService) {}

  /**
   * Create a new craft product
   * POST /craft-products
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() data: CreateCraftProductDto) {
    return this.craftProductService.create(data);
  }

  /**
   * Get all craft products (optionally filtered by productId)
   * GET /craft-products?productId=1
   */
  @Get()
  findAll(@Query('productId') productId?: string) {
    if (productId) {
      return this.craftProductService.findByProductId(parseInt(productId));
    }
    return this.craftProductService.findAll();
  }

  /**
   * Get craft products by productId (returns all craft products for a product)
   * GET /craft-products/product/:productId
   */
  @Get('product/:productId')
  findByProduct(@Param('productId', ParseIntPipe) productId: number) {
    return this.craftProductService.findByProductId(productId);
  }

  /**
   * Get a single craft product by productId (returns the first/active one)
   * GET /craft-products/by-product/:productId
   */
  @Get('by-product/:productId')
  findOneByProductId(@Param('productId', ParseIntPipe) productId: number) {
    return this.craftProductService.findOneByProductId(productId);
  }

  /**
   * Get a single craft product by its ID
   * GET /craft-products/:id
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.craftProductService.findOne(id);
  }

  /**
   * Update craft product by its ID
   * PUT /craft-products/:id
   */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateCraftProductDto,
  ) {
    return this.craftProductService.update(id, data);
  }

  /**
   * Update craft product by productId
   * PUT /craft-products/product/:productId
   */
  @Put('product/:productId')
  updateByProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() data: UpdateCraftProductDto,
  ) {
    return this.craftProductService.updateByProductId(productId, data);
  }

  /**
   * Delete craft product by ID
   * DELETE /craft-products/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.craftProductService.remove(id);
  }

  /**
   * Sell craft product by ID
   * POST /craft-products/:id/sell
   */
  @Post(':id/sell')
  sell(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: SellCraftProductDto,
  ) {
    return this.craftProductService.sell(id, data.amount);
  }

  /**
   * Sell craft product by productId
   * POST /craft-products/product/:productId/sell
   */
  @Post('product/:productId/sell')
  sellByProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() data: SellCraftProductDto,
  ) {
    return this.craftProductService.sellByProductId(productId, data.amount);
  }

  /**
   * Update stock by ID
   * POST /craft-products/:id/stock
   */
  @Post(':id/stock')
  updateStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateStockDto,
  ) {
    return this.craftProductService.updateStock(id, data.amount);
  }

  /**
   * Update stock by productId
   * POST /craft-products/product/:productId/stock
   */
  @Post('product/:productId/stock')
  updateStockByProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() data: UpdateStockDto,
  ) {
    return this.craftProductService.updateStockByProductId(
      productId,
      data.amount,
    );
  }

  /**
   * Recalculate price by ID
   * POST /craft-products/:id/recalculate
   */
  @Post(':id/recalculate')
  recalculate(@Param('id', ParseIntPipe) id: number) {
    return this.craftProductService.recalculatePrice(id);
  }

  /**
   * Recalculate price by productId
   * POST /craft-products/product/:productId/recalculate
   */
  @Post('product/:productId/recalculate')
  recalculateByProduct(@Param('productId', ParseIntPipe) productId: number) {
    return this.craftProductService.recalculatePriceByProductId(productId);
  }
}
