/*
  Warnings:

  - A unique constraint covering the columns `[invitationTokenHash]` on the table `BusinessMember` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "BusinessMember" ADD COLUMN     "invitationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "invitationTokenHash" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessMember_invitationTokenHash_key" ON "BusinessMember"("invitationTokenHash");

-- CreateIndex
CREATE INDEX "BusinessMember_invitationExpiresAt_idx" ON "BusinessMember"("invitationExpiresAt");
