-- DropIndex
DROP INDEX "Product_tenantId_barcode_key";

-- DropIndex
DROP INDEX "Product_tenantId_baseSku_batchCode_key";

-- DropIndex
DROP INDEX "Product_tenantId_baseSku_idx";

-- Backfill item type from the old trackInventory flag before dropping it
UPDATE "Product" SET "type" = 'NonInventory' WHERE "type" IS NULL AND "trackInventory" = false;
UPDATE "Product" SET "type" = 'Inventory' WHERE "type" IS NULL;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "barcode",
DROP COLUMN "baseSku",
DROP COLUMN "batchCode",
DROP COLUMN "brand",
DROP COLUMN "imageAltText",
DROP COLUMN "imageUrl",
DROP COLUMN "isDraft",
DROP COLUMN "requiresWarehousePickup",
DROP COLUMN "taxable",
DROP COLUMN "trackInventory",
DROP COLUMN "unitType",
DROP COLUMN "variationConfig",
ADD COLUMN     "expenseAccount" TEXT,
ADD COLUMN     "incomeAccount" TEXT,
ADD COLUMN     "inventoryAssetAccount" TEXT,
ADD COLUMN     "purchaseDescription" TEXT,
ADD COLUMN     "quantityAsOfDate" TIMESTAMP(3),
ALTER COLUMN "type" SET NOT NULL,
ALTER COLUMN "type" SET DEFAULT 'Inventory';

