import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

// Convert the supplied AI-generated illustrations into presentation-ready WebP.
// The design-reference screenshot is deliberately never copied into the site.
const source = process.argv[2];
if (!source)
  throw new Error("Pass the extracted RK_Luxmnl_Website_Images directory.");
const groups = {
  hero: ["hero-gold-diamond-ring"],
  products: [
    "solitaire-diamond-ring",
    "three-stone-diamond-ring",
    "pear-halo-diamond-pendant",
    "diamond-cluster-earrings",
    "diamond-tennis-bracelet",
    "emerald-gemstone-ring",
    "gold-diamond-hoop-earrings",
    "emerald-cut-diamond-ring",
    "blue-sapphire-ring",
    "ruby-halo-ring",
  ],
  categories: [
    "category-rings",
    "category-necklaces",
    "category-earrings",
    "category-bracelets",
    "category-gemstones",
  ],
  backgrounds: [
    "champagne-silk",
    "cream-marble-gold",
    "custom-ring-design-workspace",
    "loose-diamond-stones",
    "private-jewelry-showroom",
  ],
};
for (const [group, names] of Object.entries(groups)) {
  const target = path.join("public", "images", group);
  await mkdir(target, { recursive: true });
  for (const name of names) {
    const input = path.join(source, group, `${name}.jpg`);
    const info = await sharp(input)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 86 })
      .toFile(path.join(target, `${name}.webp`));
    if (group === "products")
      await sharp(input)
        .rotate()
        .resize({ width: 360, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path.join(target, `${name}-360.webp`));
    if (group === "hero")
      await sharp(input)
        .rotate()
        .resize({ width: 768, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(path.join(target, `${name}-768.webp`));
    console.log(
      `${group}/${name}: ${info.width}×${info.height}, ${Math.round(info.size / 1024)} KB`,
    );
  }
}
await sharp(path.join(source, "products", "solitaire-diamond-ring.jpg"))
  .extract({ left: 150, top: 150, width: 460, height: 460 })
  .webp({ quality: 88 })
  .toFile("public/images/products/solitaire-diamond-ring-detail.webp");
