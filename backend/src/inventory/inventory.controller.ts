// src/inventory/inventory.controller.ts (updated with all CRUD endpoints)
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { StockMovementService } from './stock-movement.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import {
  CreateInventoryCountDto,
  SubmitInventoryCountDto,
} from './dto/create-inventory-count.dto';
import { UpdateStockAlertDto } from './dto/stock-alert.dto';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockMovementType, StockMovementStatus } from '@prisma/client';
import { StockAlertService } from './stock-alert.service';
import { PrismaService } from 'src/prisma.service';
import { UpdateStockMovementDto } from './dto/update-stock-movement.dto';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly stockMovementService: StockMovementService,
    private readonly stockAlertService: StockAlertService,
  ) {}

  // ==================== STOCK MOVEMENTS CRUD ====================
  // GET last stock movement for each product
  @Get('movements/last-per-product')
  async getLastMovementForEachProduct() {
    return await this.stockMovementService.getLastMovementForEachProduct();
  }

  // Optional: GET with filters
  @Get('movements/last-per-product/summary')
  async getLastMovementSummary() {
    const data =
      await this.stockMovementService.getLastMovementForEachProduct();

    return {
      totalProducts: data.length,
      productsWithMovements: data.filter((item) => item.hasMovements).length,
      productsWithoutMovements: data.filter((item) => !item.hasMovements)
        .length,
      stockStatusSummary: {
        outOfStock: data.filter((item) => item.stockStatus === 'OUT_OF_STOCK')
          .length,
        critical: data.filter((item) => item.stockStatus === 'CRITICAL').length,
        low: data.filter((item) => item.stockStatus === 'LOW').length,
        ok: data.filter((item) => item.stockStatus === 'OK').length,
      },
      data: data,
    };
  }

  // GET all movements with pagination and filters
  @Get('movements')
  async getAllMovements(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('productId') productId?: string,
    @Query('type') type?: StockMovementType,
    @Query('status') status?: StockMovementStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.stockMovementService.getAllMovements({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      productId: productId ? parseInt(productId) : undefined,
      type,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  // GET single movement by ID
  @Get('movements/:id')
  async getMovementById(@Param('id', ParseIntPipe) id: number) {
    return await this.stockMovementService.getMovementById(id);
  }

  // POST create new movement
  @Post('movements')
  async createMovement(
    @Body() createDto: CreateStockMovementDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || 1;

    if (!createDto.productId) {
      throw new BadRequestException('productId is required');
    }

    return await this.stockMovementService.createStockMovement(
      createDto.productId,
      userId,
      createDto,
    );
  }

  // PATCH update movement
  @Patch('movements/:id')
  async updateMovement(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateStockMovementDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || 1;
    return await this.stockMovementService.updateMovement(
      id,
      userId,
      updateDto,
    );
  }

  // PUT update movement (alternative)
  @Put('movements/:id')
  async putUpdateMovement(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateStockMovementDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || 1;
    return await this.stockMovementService.updateMovement(
      id,
      userId,
      updateDto,
    );
  }

  // DELETE cancel movement
  @Delete('movements/:id')
  async cancelMovement(
    @Param('id', ParseIntPipe) id: number,
    @Query('reason') reason: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || 1;
    return await this.stockMovementService.cancelMovement(id, userId, reason);
  }

  // PATCH cancel movement (alternative)
  @Patch('movements/:id/cancel')
  async softCancelMovement(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || 1;
    return await this.stockMovementService.cancelMovement(id, userId, reason);
  }

  // GET movements with comparison (old/new stock)
  @Get('products/:id/movements/comparison')
  async getProductMovementsWithComparison(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: StockMovementType,
  ) {
    return await this.stockMovementService.getProductMovementsWithComparison(
      id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      type,
    );
  }

  // GET movement summary for dashboard
  @Get('movements/summary')
  async getMovementSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.stockMovementService.getMovementSummaryGlobal(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // ==================== EXISTING ENDPOINTS ====================

  // Product inventory endpoints
  @Get('products/:id')
  async getProductInventory(@Param('id', ParseIntPipe) id: number) {
    return await this.inventoryService.getProductInventory(id);
  }

  @Get('summary')
  async getInventorySummary(
    @Query('lowStock') lowStock?: string,
    @Query('criticalStock') criticalStock?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
  ) {
    return await this.inventoryService.getAllInventorySummary({
      lowStock: lowStock === 'true',
      criticalStock: criticalStock === 'true',
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      brandId: brandId ? parseInt(brandId) : undefined,
    });
  }

  // Stock adjustment endpoints
  @Post('products/:id/adjust')
  async adjustStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() adjustDto: AdjustStockDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || 1;
    return await this.inventoryService.adjustStock(id, userId, adjustDto);
  }

  // Stock movement endpoints (existing)
  @Get('products/:id/movements')
  async getProductMovements(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: StockMovementType,
  ) {
    return await this.stockMovementService.getProductMovements(
      id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      type,
    );
  }

  @Get('products/:id/movements/summary')
  async getProductMovementSummary(
    @Param('id', ParseIntPipe) id: number,
    @Query('days') days?: string,
  ) {
    return await this.stockMovementService.getMovementSummary(
      id,
      days ? parseInt(days) : 30,
    );
  }

  // Stock reservation endpoints
  @Post('reserve')
  async reserveStock(@Body() reserveDto: ReserveStockDto, @Req() req: any) {
    const userId = req.user?.id || 1;
    return await this.inventoryService.reserveStock(userId, reserveDto);
  }

  @Delete('reserve/:id')
  async releaseReservation(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const userId = req.user?.id || 1;
    return await this.inventoryService.releaseReservation(id, userId);
  }

  // Inventory count endpoints
  @Post('counts')
  async createInventoryCount(
    @Body() data: CreateInventoryCountDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || 1;
    return await this.inventoryService.createInventoryCount(userId, data);
  }

  @Get('counts')
  async getInventoryCounts() {
    return await this.prisma.inventoryCount.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('counts/:id')
  async getInventoryCount(@Param('id', ParseIntPipe) id: number) {
    const count = await this.prisma.inventoryCount.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!count) {
      throw new NotFoundException(`Inventory count with id ${id} not found`);
    }

    return count;
  }

  @Put('counts/:id/submit')
  async submitInventoryCount(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: SubmitInventoryCountDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || 1;
    return await this.inventoryService.submitInventoryCount(id, userId, data);
  }

  // Stock alert endpoints
  @Get('alerts')
  async getStockAlerts() {
    return await this.inventoryService.getStockAlerts();
  }

  @Get('alerts/low-stock')
  async getLowStockProducts() {
    return await this.stockAlertService.getLowStockProducts();
  }

  @Get('products/:id/alert')
  async getProductAlert(@Param('id', ParseIntPipe) id: number) {
    return await this.stockAlertService.getProductAlert(id);
  }

  @Put('products/:id/alert')
  async updateProductAlert(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateStockAlertDto,
  ) {
    return await this.stockAlertService.updateProductAlert(id, data);
  }
}
