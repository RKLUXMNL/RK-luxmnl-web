import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL || "http://localhost:3001";
  const products = await db.product.findMany({
    where: { published: true, archived: false, isDemo: false },
    select: { slug: true, updatedAt: true },
  });
  return [
    ...[
      "",
      "/shop",
      "/customization",
      "/book-a-viewing",
      "/about",
      "/contact",
      "/live-selling",
      "/reels",
    ].map((path) => ({
      url: `${base}${path}`,
      changeFrequency: "weekly" as const,
    })),
    ...products.map((p) => ({
      url: `${base}/products/${p.slug}`,
      lastModified: p.updatedAt,
    })),
  ];
}
