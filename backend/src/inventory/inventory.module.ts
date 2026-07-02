import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { ProductsModule } from 'src/products/products.module';
import { StockMovementService } from './stock-movement.service';
import { StockAlertService } from './stock-alert.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  imports: [ProductsModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    StockMovementService,
    StockAlertService,
    PrismaService,
  ],
  exports: [InventoryService, StockMovementService, StockAlertService],
})
export class InventoryModule {}
