-- CreateTable
CREATE TABLE "SaleInvoiceService" (
    "id" SERIAL NOT NULL,
    "saleInvoiceId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleInvoiceService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaleInvoiceService_saleInvoiceId_serviceId_key" ON "SaleInvoiceService"("saleInvoiceId", "serviceId");

-- AddForeignKey
ALTER TABLE "SaleInvoiceService" ADD CONSTRAINT "SaleInvoiceService_saleInvoiceId_fkey" FOREIGN KEY ("saleInvoiceId") REFERENCES "SaleInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleInvoiceService" ADD CONSTRAINT "SaleInvoiceService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
