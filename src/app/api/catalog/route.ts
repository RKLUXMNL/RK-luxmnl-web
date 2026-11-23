import { publishedProducts } from "@/lib/catalog";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { failure, json } from "@/lib/security";
export async function GET() {
  try {
    return json({
      products: await publishedProducts(),
      categories: await db.category.findMany({
        where: { archived: false },
        orderBy: { name: "asc" },
      }),
      settings: await getSettings(),
    });
  } catch (e) {
    return failure(e);
  }
}
