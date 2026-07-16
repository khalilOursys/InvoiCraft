-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "ProductionOrderPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "production_orders" (
    "id" SERIAL NOT NULL,
    "unit" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION,
    "salePrice" DOUBLE PRECISION,
    "marginPercent" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "vat" DOUBLE PRECISION NOT NULL DEFAULT 19,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "productId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDelivery" TIMESTAMP(3),
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "ProductionOrderPriority" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "quantityProduced" DOUBLE PRECISION,
    "wasteAmount" DOUBLE PRECISION,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_materials" (
    "id" SERIAL NOT NULL,
    "productionOrderId" INTEGER NOT NULL,
    "rawMaterialId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "production_order_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_services" (
    "id" SERIAL NOT NULL,
    "productionOrderId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,

    CONSTRAINT "production_order_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_order_materials_productionOrderId_rawMaterialId_key" ON "production_order_materials"("productionOrderId", "rawMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "production_order_services_productionOrderId_serviceId_key" ON "production_order_services"("productionOrderId", "serviceId");

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_materials" ADD CONSTRAINT "production_order_materials_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_materials" ADD CONSTRAINT "production_order_materials_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_services" ADD CONSTRAINT "production_order_services_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_services" ADD CONSTRAINT "production_order_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
