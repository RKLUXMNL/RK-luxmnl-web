CREATE TABLE "SparkleStory" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SparkleStory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SparkleStory_published_createdAt_idx" ON "SparkleStory"("published", "createdAt");
