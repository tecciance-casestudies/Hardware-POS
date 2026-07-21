-- CreateTable
CREATE TABLE "DocumentSequence" (
    "tenantId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("tenantId","docType")
);


-- Seed the counters from existing documents so new numbers continue past the
-- current maximum (no collision with already-issued numbers). We take the
-- greater of the max trailing-digit suffix and the row count per tenant, which
-- is robust to gaps and to custom quotation number formats.
INSERT INTO "DocumentSequence" ("tenantId", "docType", "value")
SELECT "tenantId", 'SALE',
       GREATEST(COALESCE(MAX(CAST(substring("saleNumber" FROM '(\d+)$') AS INTEGER)), 0), COUNT(*)::int)
FROM "Sale" GROUP BY "tenantId"
ON CONFLICT ("tenantId", "docType") DO NOTHING;

INSERT INTO "DocumentSequence" ("tenantId", "docType", "value")
SELECT "tenantId", 'RETURN',
       GREATEST(COALESCE(MAX(CAST(substring("returnNumber" FROM '(\d+)$') AS INTEGER)), 0), COUNT(*)::int)
FROM "Return" GROUP BY "tenantId"
ON CONFLICT ("tenantId", "docType") DO NOTHING;

INSERT INTO "DocumentSequence" ("tenantId", "docType", "value")
SELECT "tenantId", 'QUOTATION',
       GREATEST(COALESCE(MAX(CAST(substring("quotationNumber" FROM '(\d+)$') AS INTEGER)), 0), COUNT(*)::int)
FROM "Quotation" GROUP BY "tenantId"
ON CONFLICT ("tenantId", "docType") DO NOTHING;
