import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma.service';
import { UnitService } from '../unit/unit.service';
import { UnitConverter } from '../utils/unit-converter.util';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, PrismaService, UnitService, UnitConverter],
})
export class ProductsModule {}
