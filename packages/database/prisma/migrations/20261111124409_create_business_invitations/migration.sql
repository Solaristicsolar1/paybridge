-- CreateEnum
CREATE TYPE "BusinessInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateTable
CREATE TABLE "BusinessInvitation" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "role" "BusinessRole" NOT NULL DEFAULT 'MEMBER',
    "status" "BusinessInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" VARCHAR(64),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "invitedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessInvitation_tokenHash_key" ON "BusinessInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "BusinessInvitation_businessId_email_status_idx" ON "BusinessInvitation"("businessId", "email", "status");

-- CreateIndex
CREATE INDEX "BusinessInvitation_email_status_idx" ON "BusinessInvitation"("email", "status");

-- CreateIndex
CREATE INDEX "BusinessInvitation_businessId_status_idx" ON "BusinessInvitation"("businessId", "status");

-- CreateIndex
CREATE INDEX "BusinessInvitation_expiresAt_status_idx" ON "BusinessInvitation"("expiresAt", "status");

-- AddForeignKey
ALTER TABLE "BusinessInvitation" ADD CONSTRAINT "BusinessInvitation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessInvitation" ADD CONSTRAINT "BusinessInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ensure only one pending invitation exists
-- for each email address within a business.
CREATE UNIQUE INDEX "BusinessInvitation_pending_business_email_key" ON "BusinessInvitation" ("businessId", "email")
WHERE
    "status" = 'PENDING';