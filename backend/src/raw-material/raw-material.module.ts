import { Module } from '@nestjs/common';
import { RawMaterialService } from './raw-material.service';
import { RawMaterialController } from './raw-material.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [RawMaterialController],
  providers: [RawMaterialService, PrismaService],
  exports: [RawMaterialService],
})
export class RawMaterialModule {}
