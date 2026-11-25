export const instagram = "https://www.instagram.com/rkluxmnl/";
export const facebook = "https://www.facebook.com/rkluxmnl";
// Editorial illustrations can also be used by explicitly enabled demo records.
export const photos = {
  ring: "/images/backgrounds/loose-diamond-stones.webp",
  rings: "/images/backgrounds/custom-ring-design-workspace.webp",
  necklace: "/images/hero/hero-gold-diamond-ring.webp",
  earrings: "/images/categories/category-earrings.webp",
  bracelet: "/images/categories/category-bracelets.webp",
  gem: "/images/categories/category-gemstones.webp",
  hero: "/images/hero/hero-gold-diamond-ring.webp",
  custom: "/images/backgrounds/custom-ring-design-workspace.webp",
  showroom: "/images/backgrounds/loose-diamond-stones.webp",
};
export const categoryPhotos = [
  "rings",
  "necklaces",
  "earrings",
  "bracelets",
  "gemstones",
].map((name) => `/images/categories/category-${name}.webp`);
export function categoryPhoto(name: string) {
  const label = name.toLowerCase();
  const key = label.includes("gem")
    ? "gemstones"
    : label.includes("earring")
      ? "earrings"
      : label.includes("bracelet")
        ? "bracelets"
        : label.includes("necklace") || label.includes("pendant")
          ? "necklaces"
          : label.includes("ring")
            ? "rings"
            : null;
  return key ? `/images/categories/category-${key}.webp` : photos.custom;
}
export const categories = [
  "Diamond Rings",
  "Necklaces and Pendants",
  "Earrings",
  "Bracelets",
  "Gemstone Jewelry",
  "Other Jewelry",
];
export type ProductPlacement = "SHOWROOM" | "LIVE";
export type Product = {
  id: string;
  slug: string;
  isDemo: boolean;
  name: string;
  category: string;
  categoryId: string;
  categories: string[];
  categoryIds: string[];
  price: number | null;
  originalPrice: number | null;
  placement: ProductPlacement;
  description: string;
  status: string;
  images: string[];
  media: ProductMedia[];
  videos: { id: string; provider: string; url: string }[];
  specifications: Record<string, string>;
  policies: Record<string, string>;
  authenticityEnabled: boolean;
  authenticityText: string;
  certificateType: string;
  certificateNumber: string;
  certificateIssuer: string;
  certificateUrl: string | null;
};
export const isSaleProduct = (p: Pick<Product, "categories">) =>
  p.categories.some((name) => name.trim().toLowerCase() === "sale");
export const hasStrikePrice = (
  p: Pick<Product, "originalPrice" | "price">,
) =>
  p.price !== null && p.originalPrice !== null && p.originalPrice > p.price;
export type ProductMedia = {
  id: string;
  kind: "image" | "video";
  provider: string;
  url: string;
};
export const money = (price: number | null) =>
  price === null
    ? "Price Upon Inquiry"
    : new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(price);
