/*
  Warnings:

  - Added the required column `reference` to the `services` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "services" ADD COLUMN     "description" TEXT,
ADD COLUMN     "reference" TEXT NOT NULL;
