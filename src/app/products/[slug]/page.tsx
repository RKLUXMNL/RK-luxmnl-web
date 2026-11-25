import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { productDto, productInclude, publishedProduct } from "@/lib/catalog";
import { ProductDetails } from "@/components/product-detail";
import { publicProductWhere } from "@/lib/public-products";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await publishedProduct(slug);
  if (!p)
    return {
      title: "Jewelry not found",
      robots: { index: false, follow: false },
    };
  return {
    title: `${p.name} | RK Luxmnl`,
    ...(p.isDemo ? { robots: { index: false, follow: false } } : {}),
    description:
      p.description.slice(0, 160) ||
      `Discover ${p.name} at RK Luxmnl Diamond Jewelry.`,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: {
      title: p.name,
      description: p.description.slice(0, 160),
      images: p.images.slice(0, 1),
    },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await publishedProduct(slug);
  if (!product) notFound();
  const related = (
    await db.product.findMany({
      where: {
        ...publicProductWhere(),
        AND: [
          {
            OR: [
              {
                productCategories: {
                  some: { categoryId: { in: product.categoryIds } },
                },
              },
              { categoryId: product.categoryId },
            ],
          },
        ],
        id: { not: product.id },
      },
      include: productInclude,
      take: 4,
      orderBy: { createdAt: "desc" },
    })
  ).map(productDto);
  const base = process.env.APP_URL || "http://localhost:3001";
  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((image) => new URL(image, base).href),
    url: `${base}/products/${product.slug}`,
    ...(product.price !== null
      ? {
          offers: {
            "@type": "Offer",
            price: product.price,
            priceCurrency: "PHP",
            url: `${base}/products/${product.slug}`,
            availability: `https://schema.org/${product.status === "Sold" ? "OutOfStock" : product.status === "Made to Order" ? "PreOrder" : product.status === "Reserved" ? "LimitedAvailability" : "InStock"}`,
          },
        }
      : {}),
  };
  return (
    <>
      {!product.isDemo && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <ProductDetails product={product} related={related} />
    </>
  );
}
