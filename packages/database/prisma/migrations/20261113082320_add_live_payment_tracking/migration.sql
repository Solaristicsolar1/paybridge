/*
  Warnings:

  - A unique constraint covering the columns `[providerCorrelationId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "depositMemo" TEXT,
ADD COLUMN     "destinationAssetId" VARCHAR(300),
ADD COLUMN     "providerCorrelationId" TEXT,
ADD COLUMN     "providerResponse" JSONB,
ADD COLUMN     "providerStatus" VARCHAR(80),
ADD COLUMN     "sourceAssetId" VARCHAR(300),
ALTER COLUMN "destinationChain" SET DEFAULT 'base';

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerCorrelationId_key" ON "Payment"("providerCorrelationId");

-- CreateIndex
CREATE INDEX "Payment_providerStatus_idx" ON "Payment"("providerStatus");

-- CreateIndex
CREATE INDEX "Payment_depositAddress_idx" ON "Payment"("depositAddress");
