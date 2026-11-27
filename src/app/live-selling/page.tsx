import { db } from "@/lib/db";
import { productDto, productInclude } from "@/lib/catalog";
import { LiveSelling } from "@/components/live";
import { publicProductWhere } from "@/lib/public-products";
export const metadata = {
  title: "Live Selling Calendar & Replays | RK Luxmnl",
  description:
    "Join RK Luxmnl Instagram or Facebook Live sessions, watch available recordings and explore featured jewelry.",
  alternates: { canonical: "/live-selling" },
};
export default async function Page() {
  const rows = await db.liveSellingSession.findMany({
    where: { published: true },
    include: {
      replay: true,
      thumbnail: true,
      trailer: true,
      products: {
        where: { product: publicProductWhere() },
        include: { product: { include: productInclude } },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { startsAt: "desc" },
  });
  const liveProducts = (
    await db.product.findMany({
      where: { ...publicProductWhere(), placement: "LIVE" },
      include: productInclude,
      orderBy: { createdAt: "desc" },
    })
  ).map(productDto);
  const sessions = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt.toISOString(),
    status: row.status,
    instagramUrl: row.instagramUrl,
    facebookUrl: row.facebookUrl,
    replay:
      row.replay?.state === "ready"
        ? { id: row.replay.id, provider: row.replay.provider }
        : null,
    thumbnail:
      row.thumbnail?.state === "ready" ? { id: row.thumbnail.id } : null,
    trailer:
      row.trailer?.state === "ready"
        ? { id: row.trailer.id, provider: row.trailer.provider }
        : null,
    products: row.products.map((item) => ({
      product: productDto(item.product),
      timestamp: item.timestamp,
    })),
  }));
  return <LiveSelling sessions={sessions} liveProducts={liveProducts} />;
}
