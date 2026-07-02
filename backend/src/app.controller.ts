import { Controller, Get } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller()
export class AppController {
  @Get('/health')
  healthCheck() {
    return { status: 'ok', timestamp: new Date() };
  }

  @Get('/test-products')
  async testProducts() {
    return prisma.product.findMany();
  }
}
