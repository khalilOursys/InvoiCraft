import { Module } from '@nestjs/common';
import { HeroBannerService } from './hero-banner.service';
import { HeroBannerController } from './hero-banner.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [HeroBannerController],
  providers: [HeroBannerService, PrismaService],
  exports: [HeroBannerService],
})
export class HeroBannerModule {}
