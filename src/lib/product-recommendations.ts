import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { productDto, productInclude } from "./catalog";
import type { Product } from "./data";
import { publicProductWhere } from "./public-products";
const stopWords = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "carat",
  "carats",
  "ct",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "with",
]);
function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function tokens(value: string) {
  return (normalize(value).match(/\d+(?:\.\d+)?|[a-z]+/gi) || [])
    .map((token) => {
      const number = Number(token);
      return Number.isFinite(number) && token.includes(".") ? String(number) : token;
    })
    .filter((token) => token.length > 1 && !stopWords.has(token));
}
function carats(value: string) {
  return Array.from(
    value.matchAll(/(\d+(?:\.\d+)?)\s*(?:ct|carat|carats)\b/gi),
    (match) => String(Number(match[1])),
  );
}
function productCarats(product: Product) {
  return Array.from(
    new Set([
      ...carats(product.name),
      ...carats(product.description),
      ...carats(String(product.specifications.carat || "")),
    ]),
  );
}
function sharedCount(left: string[], right: string[]) {
  const values = new Set(right);
  return new Set(left).size
    ? Array.from(new Set(left)).filter((value) => values.has(value)).length
    : 0;
}
export function similarityScore(source: Product, candidate: Product) {
  const sourceTitle = tokens(source.name),
    candidateTitle = tokens(candidate.name),
    sourceDescription = tokens(source.description),
    candidateDescription = tokens(candidate.description),
    sourceCarats = productCarats(source),
    candidateCarats = productCarats(candidate);
  const titleOverlap = sharedCount(sourceTitle, candidateTitle),
    descriptionOverlap = sharedCount(sourceDescription, candidateDescription),
    categoryOverlap = source.categoryIds.some((id) =>
      candidate.categoryIds.includes(id),
    );
  const sameCarat = sourceCarats.some((value) =>
    candidateCarats.includes(value),
  );
  const titleCarat =
    sameCarat &&
    sourceCarats.some((value) => carats(source.name).includes(value)) &&
    candidateCarats.some((value) => carats(candidate.name).includes(value));
  const sharedSpecs = [
    "metal",
    "purity",
    "gemstone",
    "setting",
    "color",
    "inclusions",
  ].filter((key) => {
    const value = source.specifications[key]?.trim().toLowerCase();
    return value && value === candidate.specifications[key]?.trim().toLowerCase();
  }).length;
  const priceGap =
    source.price !== null && candidate.price !== null
      ? Math.abs(source.price - candidate.price) /
        Math.max(source.price, candidate.price)
      : 1;
  return (
    titleOverlap * 6 +
    Math.min(descriptionOverlap, 12) * 1.5 +
    (categoryOverlap ? 8 : 0) +
    (titleCarat ? 30 : sameCarat ? 14 : 0) +
    sharedSpecs * 4 +
    Math.max(0, 3 - priceGap * 6)
  );
}
export function rankSimilarProducts(
  source: Product,
  candidates: Product[],
  limit = 4,
) {
  return candidates
    .filter((candidate) => candidate.id !== source.id)
    .map((candidate) => ({ candidate, score: similarityScore(source, candidate) }))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.candidate.name.localeCompare(b.candidate.name),
    )
    .slice(0, limit)
    .map((item) => item.candidate);
}
export async function relatedProducts(product: Product, limit = 4) {
  const titleTerms = tokens(product.name).slice(0, 10),
    descriptionTerms = tokens(product.description).slice(0, 6),
    caratTerms = productCarats(product),
    clauses: Prisma.ProductWhereInput[] = [
      { categoryId: { in: product.categoryIds } },
      {
        productCategories: {
          some: { categoryId: { in: product.categoryIds } },
        },
      },
    ];
  for (const term of titleTerms) {
    clauses.push(
      { name: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    );
  }
  for (const term of descriptionTerms) {
    clauses.push({ name: { contains: term, mode: "insensitive" } });
  }
  for (const value of caratTerms) {
    for (const variant of [value, `${value}ct`, `${value} ct`]) {
      clauses.push(
        { name: { contains: variant, mode: "insensitive" } },
        { description: { contains: variant, mode: "insensitive" } },
        { specifications: { path: ["carat"], string_contains: variant } },
      );
    }
  }
  const candidates = (
    await db.product.findMany({
      where: {
        AND: [
          publicProductWhere(),
          { id: { not: product.id } },
          { OR: clauses },
        ],
      },
      include: productInclude,
      orderBy: { createdAt: "desc" },
      take: 120,
    })
  ).map(productDto);
  const ranked = rankSimilarProducts(product, candidates, limit);
  if (ranked.length) return ranked;
  return candidates.slice(0, limit);
}
