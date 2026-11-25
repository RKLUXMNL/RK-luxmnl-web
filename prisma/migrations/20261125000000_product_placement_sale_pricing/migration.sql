CREATE TYPE "ProductPlacement" AS ENUM ('SHOWROOM', 'LIVE');

ALTER TABLE "Product"
  ADD COLUMN "originalPrice" DECIMAL(14,2),
  ADD COLUMN "placement" "ProductPlacement" NOT NULL DEFAULT 'SHOWROOM';

CREATE INDEX "Product_published_archived_placement_idx" ON "Product"("published", "archived", "placement");
