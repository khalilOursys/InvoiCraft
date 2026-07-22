// src/utils/utils.module.ts

import { Module } from '@nestjs/common';
import { UnitConverter } from './unit-converter.util';
import { UnitService } from '../unit/unit.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [UnitConverter, UnitService, PrismaService],
  exports: [UnitConverter],
})
export class UtilsModule {}
