import { Prisma } from "@prisma/client";
const specificationKeys = [
  "brand",
  "color",
  "condition",
  "inclusions",
  "otherDetails",
  "metal",
  "purity",
  "gemstone",
  "carat",
  "size",
  "weight",
  "setting",
  "customization",
];
const policyKeys = ["installment", "payment", "delivery"];
export function productSearchWhere(query: string): Prisma.ProductWhereInput {
  const terms = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  if (!terms.length) return {};
  return {
    AND: terms.map((term) => {
      const numeric = term.replace(/[^0-9.]/g, "");
      const amount =
        numeric && Number.isFinite(Number(numeric)) ? Number(numeric) : null;
      const placement =
        term === "live" || term === "showroom"
          ? (term.toUpperCase() as "LIVE" | "SHOWROOM")
          : null;
      return {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { slug: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
          { availability: { contains: term, mode: "insensitive" } },
          { authenticityText: { contains: term, mode: "insensitive" } },
          { certificateType: { contains: term, mode: "insensitive" } },
          { certificateNumber: { contains: term, mode: "insensitive" } },
          { certificateIssuer: { contains: term, mode: "insensitive" } },
          { category: { name: { contains: term, mode: "insensitive" } } },
          {
            productCategories: {
              some: { category: { name: { contains: term, mode: "insensitive" } } },
            },
          },
          ...specificationKeys.map((key) => ({
            specifications: {
              path: [key],
              string_contains: term,
              mode: "insensitive" as const,
            },
          })),
          ...policyKeys.map((key) => ({
            policies: {
              path: [key],
              string_contains: term,
              mode: "insensitive" as const,
            },
          })),
          ...(amount === null
            ? []
            : [{ price: { equals: amount } }, { originalPrice: { equals: amount } }]),
          ...(placement ? [{ placement: { equals: placement } }] : []),
        ],
      };
    }),
  };
}
