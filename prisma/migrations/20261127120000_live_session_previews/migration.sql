ALTER TABLE "LiveSellingSession" ADD COLUMN "thumbnailId" TEXT;
ALTER TABLE "LiveSellingSession" ADD COLUMN "trailerId" TEXT;

ALTER TABLE "LiveSellingSession" ADD CONSTRAINT "LiveSellingSession_thumbnailId_fkey" FOREIGN KEY ("thumbnailId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LiveSellingSession" ADD CONSTRAINT "LiveSellingSession_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
