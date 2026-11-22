-- CreateIndex
CREATE INDEX "CustomReference_assetId_idx" ON "CustomReference"("assetId");

-- CreateIndex
CREATE INDEX "Inquiry_productId_idx" ON "Inquiry"("productId");

-- CreateIndex
CREATE INDEX "LiveProduct_productId_idx" ON "LiveProduct"("productId");

-- CreateIndex
CREATE INDEX "Product_certificateId_idx" ON "Product"("certificateId");

-- CreateIndex
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");

-- CreateIndex
CREATE INDEX "ProductMedia_assetId_idx" ON "ProductMedia"("assetId");

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- CreateIndex
CREATE INDEX "ReelProduct_productId_idx" ON "ReelProduct"("productId");
