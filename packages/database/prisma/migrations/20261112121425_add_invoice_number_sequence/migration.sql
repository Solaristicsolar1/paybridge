-- CreateTable
CREATE TABLE "InvoiceNumberSequence" (
    "businessId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceNumberSequence_pkey" PRIMARY KEY ("businessId","year")
);

-- CreateIndex
CREATE INDEX "InvoiceNumberSequence_businessId_idx" ON "InvoiceNumberSequence"("businessId");

-- AddForeignKey
ALTER TABLE "InvoiceNumberSequence" ADD CONSTRAINT "InvoiceNumberSequence_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
