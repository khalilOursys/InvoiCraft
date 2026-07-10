import { AppController } from './app.controller';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { Module } from '@nestjs/common';
import { ClientsModule } from './clients/clients.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchaseInvoiceModule } from './purchase-invoice/purchase-invoice.module';
import { SaleInvoiceModule } from './sale-invoice/sale-invoice.module';
import { PaymentsModule } from './payments/payments.module';
import { CompanySettingsModule } from './company-settings/company-settings.module';
import { RefundInvoiceModule } from './refund-invoice/refund-invoice.module';
import { CarsModule } from './cars/cars.module';
import { DriverModule } from './driver/driver.module';
import { BrandsModule } from './brands/brands.module';
import { CitiesModule } from './cities/cities.module';
import { HeroBannerModule } from './hero-banner/hero-banner.module';
import { OrderModule } from './order/order.module';
import { InventoryModule } from './inventory/inventory.module';
import { RawMaterialModule } from './raw-material/raw-material.module';
import { ServiceModule } from './service/service.module';
import { CraftProductModule } from './craft-product/craft-product.module';
import { ExpenseModule } from './expense/expense.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    ClientsModule,
    SuppliersModule,
    PurchaseInvoiceModule,
    SaleInvoiceModule,
    PaymentsModule,
    CompanySettingsModule,
    RefundInvoiceModule,
    CarsModule,
    DriverModule,
    BrandsModule,
    CitiesModule,
    HeroBannerModule,
    OrderModule,
    InventoryModule,
    DriverModule,
    RawMaterialModule,
    ServiceModule,
    CraftProductModule,
    ExpenseModule,
  ],
  controllers: [AppController],
  providers: [PrismaService],
})
export class AppModule {}
