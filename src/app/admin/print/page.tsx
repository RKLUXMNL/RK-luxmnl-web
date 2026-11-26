import { redirect } from "next/navigation";
import { session } from "@/lib/security";
import { db } from "@/lib/db";
import { productDto, productInclude } from "@/lib/catalog";
import { PrintSheet } from "@/components/print-sheet";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Print selected products | RK Luxmnl",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[] }>;
}) {
  if (!(await session())) redirect("/admin/login");
  const params = await searchParams;
  const ids = (Array.isArray(params.ids) ? params.ids.join(",") : params.ids || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 100);
  const rows = ids.length
    ? await db.product.findMany({
        where: { id: { in: ids } },
        include: productInclude,
      })
    : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const products = ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map(productDto);
  return <PrintSheet products={products} />;
}
