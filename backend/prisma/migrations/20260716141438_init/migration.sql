/*
  Warnings:

  - Made the column `unitId` on table `craft_products` required. This step will fail if there are existing NULL values in that column.
  - Made the column `unitId` on table `production_orders` required. This step will fail if there are existing NULL values in that column.
  - Made the column `unitId` on table `raw_materials` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "craft_products" DROP CONSTRAINT "craft_products_unitId_fkey";

-- DropForeignKey
ALTER TABLE "production_orders" DROP CONSTRAINT "production_orders_unitId_fkey";

-- DropForeignKey
ALTER TABLE "raw_materials" DROP CONSTRAINT "raw_materials_unitId_fkey";

-- AlterTable
ALTER TABLE "craft_products" ALTER COLUMN "unitId" SET NOT NULL;

-- AlterTable
ALTER TABLE "production_orders" ALTER COLUMN "unitId" SET NOT NULL;

-- AlterTable
ALTER TABLE "raw_materials" ALTER COLUMN "unitId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "craft_products" ADD CONSTRAINT "craft_products_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
