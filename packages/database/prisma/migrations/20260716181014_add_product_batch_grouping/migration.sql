-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "baseSku" TEXT,
ADD COLUMN     "batchCode" TEXT;

-- CreateIndex
CREATE INDEX "Product_tenantId_baseSku_idx" ON "Product"("tenantId", "baseSku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_baseSku_batchCode_key" ON "Product"("tenantId", "baseSku", "batchCode");

