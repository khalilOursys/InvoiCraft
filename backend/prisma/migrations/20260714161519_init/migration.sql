/*
  Warnings:

  - Made the column `amount` on table `craft_products` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "craft_products" ALTER COLUMN "amount" SET NOT NULL,
ALTER COLUMN "amount" SET DEFAULT 0;
