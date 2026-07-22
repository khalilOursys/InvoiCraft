/*
  Warnings:

  - You are about to drop the column `unit` on the `craft_products` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `production_orders` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `raw_materials` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "craft_products" DROP COLUMN "unit",
ADD COLUMN     "unitId" INTEGER;

-- AlterTable
ALTER TABLE "production_orders" DROP COLUMN "unit",
ADD COLUMN     "unitId" INTEGER;

-- AlterTable
ALTER TABLE "raw_materials" DROP COLUMN "unit",
ADD COLUMN     "unitId" INTEGER;

-- CreateTable
CREATE TABLE "units" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "description" TEXT,
    "family" TEXT NOT NULL DEFAULT 'unit',
    "baseUnitId" INTEGER,
    "conversionToBase" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isStandard" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "units_code_key" ON "units"("code");

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_baseUnitId_fkey" FOREIGN KEY ("baseUnitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "craft_products" ADD CONSTRAINT "craft_products_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
