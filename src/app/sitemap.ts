import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { publicProductWhere } from "@/lib/public-products";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL || "http://localhost:3001";
  const products = await db.product.findMany({
    where: publicProductWhere(),
    select: { slug: true, updatedAt: true },
  });
  return [
    ...[
      "",
      "/showroom",
      "/customization",
      "/book-a-viewing",
      "/about",
      "/contact",
      "/live-selling",
      "/reels",
      "/stories-of-sparkle",
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
