import { Module } from '@nestjs/common';
import { ProductionOrderService } from './production-order.service';
import { ProductionOrderController } from './production-order.controller';
import { PrismaService } from '../prisma.service';
import { UnitService } from '../unit/unit.service';
import { UnitConverter } from '../utils/unit-converter.util';

@Module({
  controllers: [ProductionOrderController],
  providers: [
    ProductionOrderService,
    PrismaService,
    UnitService,
    UnitConverter,
  ],
  exports: [ProductionOrderService],
})
export class ProductionOrderModule {}
