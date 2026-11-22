import { db } from "@/lib/db";
import { productDto, productInclude } from "@/lib/catalog";
import { Reels } from "@/components/live";
import { publicProductWhere } from "@/lib/public-products";
export const metadata = {
  title: "Instagram Reels & Jewelry Videos | RK Luxmnl",
  description: "Explore RK Luxmnl jewelry Reels and associated pieces.",
  alternates: { canonical: "/reels" },
};
export default async function Page() {
  const rows = await db.reel.findMany({
    where: { published: true },
    include: {
      asset: true,
      products: {
        where: { product: publicProductWhere() },
        include: { product: { include: productInclude } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const reels = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    instagramUrl: row.instagramUrl,
    downloadsEnabled:
      row.downloadsEnabled &&
      row.asset?.state === "ready" &&
      row.asset.authorized &&
      row.asset.provider === "object",
    asset:
      row.asset?.state === "ready"
        ? { id: row.asset.id, provider: row.asset.provider }
        : null,
    products: row.products.map((item) => productDto(item.product)),
  }));
  return <Reels reels={reels} />;
}
