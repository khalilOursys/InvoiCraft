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
  Patch,
} from '@nestjs/common';
import { ProductionOrderService } from './production-order.service';
import {
  CreateProductionOrderDto,
  ProductionOrderStatus,
} from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';

@Controller('production-orders')
export class ProductionOrderController {
  constructor(
    private readonly productionOrderService: ProductionOrderService,
  ) {}

  /**
   * Create a new production order
   * POST /production-orders
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() data: CreateProductionOrderDto) {
    return this.productionOrderService.create(data);
  }

  /**
   * Get all production orders (optionally filtered by productId)
   * GET /production-orders?productId=1
   */
  @Get()
  findAll(@Query('productId') productId?: string) {
    if (productId) {
      return this.productionOrderService.findByProductId(parseInt(productId));
    }
    return this.productionOrderService.findAll();
  }

  /**
   * Get production orders by productId
   * GET /production-orders/product/:productId
   */
  @Get('product/:productId')
  findByProduct(@Param('productId', ParseIntPipe) productId: number) {
    return this.productionOrderService.findByProductId(productId);
  }

  /**
   * Get a single production order by productId
   * GET /production-orders/by-product/:productId
   */
  @Get('by-product/:productId')
  findOneByProductId(@Param('productId', ParseIntPipe) productId: number) {
    return this.productionOrderService.findOneByProductId(productId);
  }

  /**
   * Get a single production order by its ID
   * GET /production-orders/:id
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productionOrderService.findOne(id);
  }

  /**
   * Update production order by its ID
   * PUT /production-orders/:id
   */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateProductionOrderDto,
  ) {
    return this.productionOrderService.update(id, data);
  }

  /**
   * Update production order by productId
   * PUT /production-orders/product/:productId
   */
  @Put('product/:productId')
  updateByProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() data: UpdateProductionOrderDto,
  ) {
    return this.productionOrderService.updateByProductId(productId, data);
  }

  /**
   * Delete production order by ID
   * DELETE /production-orders/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productionOrderService.remove(id);
  }

  /**
   * Complete a production order
   * POST /production-orders/:id/complete
   */
  @Post(':id/complete')
  completeOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body('quantityProduced') quantityProduced?: number,
  ) {
    return this.productionOrderService.completeOrder(id, quantityProduced);
  }

  /**
   * Cancel a production order
   * POST /production-orders/:id/cancel
   */
  @Post(':id/cancel')
  cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body('notes') notes?: string,
  ) {
    return this.productionOrderService.cancelOrder(id, notes);
  }

  /**
   * Update stock by ID
   * POST /production-orders/:id/stock
   */
  @Post(':id/stock')
  updateStock(
    @Param('id', ParseIntPipe) id: number,
    @Body('amount') amount: number,
  ) {
    return this.productionOrderService.updateStock(id, amount);
  }

  /**
   * Update stock by productId
   * POST /production-orders/product/:productId/stock
   */
  @Post('product/:productId/stock')
  updateStockByProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Body('amount') amount: number,
  ) {
    return this.productionOrderService.updateStockByProductId(
      productId,
      amount,
    );
  }

  /**
   * Recalculate price by ID
   * POST /production-orders/:id/recalculate
   */
  @Post(':id/recalculate')
  recalculate(@Param('id', ParseIntPipe) id: number) {
    return this.productionOrderService.recalculatePrice(id);
  }

  /**
   * Recalculate price by productId
   * POST /production-orders/product/:productId/recalculate
   */
  @Post('product/:productId/recalculate')
  recalculateByProduct(@Param('productId', ParseIntPipe) productId: number) {
    return this.productionOrderService.recalculatePriceByProductId(productId);
  }
}
