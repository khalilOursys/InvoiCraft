-- DropIndex
DROP INDEX "craft_products_reference_key";

-- AlterTable
ALTER TABLE "craft_products" ALTER COLUMN "reference" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "amount" DROP NOT NULL;
