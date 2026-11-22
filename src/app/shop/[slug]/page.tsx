import { notFound, permanentRedirect } from "next/navigation";
import { db } from "@/lib/db";
import { publicProductWhere } from "@/lib/public-products";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await db.product.findFirst({
    where: { ...publicProductWhere(), OR: [{ slug }, { id: slug }] },
    select: { slug: true },
  });
  if (!product) notFound();
  permanentRedirect(`/products/${product.slug}`);
}
