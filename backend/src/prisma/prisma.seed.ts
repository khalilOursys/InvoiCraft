import {
  PrismaClient,
  UserRole,
  PaymentMethod,
  PurchaseInvoiceType,
  SaleInvoiceType,
  InvoiceStatus,
} from '@prisma/client';

import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed process...');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
