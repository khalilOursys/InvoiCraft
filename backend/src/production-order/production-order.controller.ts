// src/production-order/production-order.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { ProductionOrderService } from './production-order.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';

@Controller('production-orders')
export class ProductionOrderController {
  constructor(
    private readonly productionOrderService: ProductionOrderService,
  ) {}

  @Get()
  async findAll() {
    return this.productionOrderService.findAll();
  }

  @Get('product/:productId')
  async findByProductId(@Param('productId', ParseIntPipe) productId: number) {
    return this.productionOrderService.findByProductId(productId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productionOrderService.findOne(id);
  }

  @Post()
  async create(@Body() data: CreateProductionOrderDto) {
    return this.productionOrderService.create(data);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateProductionOrderDto,
  ) {
    return this.productionOrderService.update(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.productionOrderService.remove(id);
  }

  @Patch(':id/complete')
  async completeOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body('quantityProduced') quantityProduced?: number,
  ) {
    return this.productionOrderService.completeOrder(id, quantityProduced);
  }

  @Patch(':id/cancel')
  async cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body('notes') notes?: string,
  ) {
    return this.productionOrderService.cancelOrder(id, notes);
  }

  @Patch(':id/stock')
  async updateStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('amount') amount: number,
  ) {
    return this.productionOrderService.updateStock(id, amount);
  }
}
