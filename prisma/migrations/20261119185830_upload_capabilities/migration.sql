-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "uploadExpiresAt" TIMESTAMP(3),
ADD COLUMN     "uploadTokenHash" TEXT;
