import { Module } from '@nestjs/common';
import { ProductionOrderService } from './production-order.service';
import { ProductionOrderController } from './production-order.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ProductionOrderController],
  providers: [ProductionOrderService, PrismaService],
  exports: [ProductionOrderService],
})
export class ProductionOrderModule {}
