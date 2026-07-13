-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'TRAIT';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "checkBank" TEXT,
ADD COLUMN     "checkDate" TIMESTAMP(3),
ADD COLUMN     "checkNumber" TEXT,
ADD COLUMN     "receiptFile" TEXT,
ADD COLUMN     "receiptFileName" TEXT,
ADD COLUMN     "traitDate" TIMESTAMP(3),
ADD COLUMN     "traitNumber" TEXT;
