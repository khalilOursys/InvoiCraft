/*
  Warnings:

  - Made the column `reference` on table `craft_products` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `craft_products` required. This step will fail if there are existing NULL values in that column.
  - Made the column `amount` on table `craft_products` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "craft_products" ALTER COLUMN "reference" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "amount" SET NOT NULL;
