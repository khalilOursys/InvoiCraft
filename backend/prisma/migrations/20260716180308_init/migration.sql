/*
  Warnings:

  - Added the required column `unitId` to the `craft_product_materials` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitId` to the `production_order_materials` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "craft_product_materials" ADD COLUMN     "unitId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "production_order_materials" ADD COLUMN     "unitId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "craft_product_materials" ADD CONSTRAINT "craft_product_materials_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_order_materials" ADD CONSTRAINT "production_order_materials_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
