import type { Prisma } from "@prisma/client";
export function demoCatalogEnabled() {
  return process.env.ENABLE_DEMO_CATALOG === "true";
}
export function publicProductWhere(): Prisma.ProductWhereInput {
  return {
    published: true,
    archived: false,
    OR: [
      { productCategories: { some: { category: { archived: false } } } },
      {
        productCategories: { none: {} },
        category: { archived: false },
      },
    ],
    ...(demoCatalogEnabled() ? {} : { isDemo: false }),
  };
}
