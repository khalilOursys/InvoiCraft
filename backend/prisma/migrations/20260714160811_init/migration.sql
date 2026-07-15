/*
  Warnings:

  - A unique constraint covering the columns `[reference]` on the table `craft_products` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "craft_products_reference_key" ON "craft_products"("reference");
