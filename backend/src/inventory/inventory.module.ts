import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { StockMovementService } from './stock-movement.service';
import { StockAlertService } from './stock-alert.service';
import { ProductsModule } from '../products/products.module';
import { PrismaService } from '../prisma.service';

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
