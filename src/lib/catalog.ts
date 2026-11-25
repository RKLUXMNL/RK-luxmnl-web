import { Prisma } from "@prisma/client";
import { db } from "./db";
import type { Product } from "./data";
import { publicProductWhere } from "./public-products";
export const productInclude = {
  category: true,
  productCategories: { include: { category: true } },
  media: { include: { asset: true }, orderBy: { position: "asc" as const } },
  certificate: true,
} satisfies Prisma.ProductInclude;
export type FullProduct = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;
export function productDto(p: FullProduct): Product {
  return {
    id: p.id,
    slug: p.slug,
    isDemo: p.isDemo,
    name: p.name,
    category: p.category.name,
    categoryId: p.categoryId,
    categories: (p.productCategories.length
      ? p.productCategories.map((item) => item.category.name)
      : [p.category.name]).sort((a, b) => a.localeCompare(b)),
    categoryIds: p.productCategories.length
      ? p.productCategories.map((item) => item.categoryId)
      : [p.categoryId],
    price: p.price === null ? null : Number(p.price),
    originalPrice:
      p.originalPrice === null ? null : Number(p.originalPrice),
    placement: p.placement,
    description: p.description,
    status: p.availability,
    media: p.media
      .filter(
        (item) =>
          item.asset.state === "ready" &&
          ["image", "video"].includes(item.asset.kind),
      )
      .map((item) => ({
        id: item.assetId,
        kind: item.asset.kind as "image" | "video",
        provider: item.asset.provider,
        url: `/api/media/${item.assetId}`,
      })),
    images: p.media
      .filter((m) => m.asset.kind === "image" && m.asset.state === "ready")
      .map((m) => `/api/media/${m.assetId}`),
    videos: p.media
      .filter((m) => m.asset.kind === "video" && m.asset.state === "ready")
      .map((m) => ({
        id: m.assetId,
        provider: m.asset.provider,
        url: `/api/media/${m.assetId}`,
      })),
    specifications: p.specifications as Record<string, string>,
    policies: p.policies as Record<string, string>,
    authenticityEnabled: p.authenticityEnabled,
    authenticityText: p.authenticityText,
    certificateType: p.certificateType,
    certificateNumber: p.certificateNumber,
    certificateIssuer: p.certificateIssuer,
    certificateUrl: p.certificateId ? `/api/media/${p.certificateId}` : null,
  };
}
export async function publishedProducts() {
  return (
    await db.product.findMany({
      where: publicProductWhere(),
      include: productInclude,
      orderBy: { createdAt: "desc" },
    })
  ).map(productDto);
}
export async function publishedProduct(slug: string) {
  const product = await db.product.findFirst({
    where: { ...publicProductWhere(), slug },
    include: productInclude,
  });
  return product ? productDto(product) : null;
}
