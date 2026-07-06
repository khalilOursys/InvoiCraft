import { Module } from '@nestjs/common';
import { CraftProductService } from './craft-product.service';
import { CraftProductController } from './craft-product.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [CraftProductController],
  providers: [CraftProductService, PrismaService],
  exports: [CraftProductService],
})
export class CraftProductModule {}
