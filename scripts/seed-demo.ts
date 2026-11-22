import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { stat } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";

const samples = [
  {
    slug: "the-aurelia-solitaire",
    name: "The Aurelia Solitaire",
    category: "Diamond Rings",
    price: 48500,
    image: "solitaire-diamond-ring",
    description:
      "A quietly captivating solitaire, designed around a single moment of brilliance.",
    detail: "solitaire-diamond-ring-detail",
  },
  {
    slug: "lumiere-pendant",
    name: "Lumière Pendant",
    category: "Necklaces and Pendants",
    price: 28500,
    image: "pear-halo-diamond-pendant",
    description: "A delicate touch of light to carry close to your heart.",
  },
  {
    slug: "celeste-diamond-studs",
    name: "Céleste Diamond Studs",
    category: "Earrings",
    price: 32000,
    image: "diamond-cluster-earrings",
    description:
      "Effortlessly refined sparkle for everyday moments and special evenings.",
  },
  {
    slug: "eternity-bracelet",
    name: "The Eternity Bracelet",
    category: "Bracelets",
    price: 65000,
    image: "diamond-tennis-bracelet",
    description: "An elegant silhouette with an enduring sense of occasion.",
  },
  {
    slug: "emerald-muse",
    name: "Emerald Muse",
    category: "Gemstone Jewelry",
    price: null,
    image: "emerald-gemstone-ring",
    description:
      "A richly colored statement inspired by the beauty of natural gemstones.",
  },
  {
    slug: "the-promise-band",
    name: "The Promise Band",
    category: "Diamond Rings",
    price: 38000,
    image: "three-stone-diamond-ring",
    description: "A modern expression of a promise made to last.",
  },
  {
    slug: "petite-gold-pendant",
    name: "Petite Gold Pendant",
    category: "Necklaces and Pendants",
    price: 18500,
    image: "pear-halo-diamond-pendant",
    description: "Understated elegance, beautifully personal.",
  },
  {
    slug: "aurora-drops",
    name: "Aurora Drops",
    category: "Earrings",
    price: 42000,
    image: "gold-diamond-hoop-earrings",
    description: "Graceful drops for the moments you want to remember.",
  },
];
async function main() {
  if (process.env.ENABLE_DEMO_CATALOG !== "true")
    throw Error(
      "Set ENABLE_DEMO_CATALOG=true to explicitly enable local test inventory.",
    );
  for (const sample of samples) {
    const id = `demo-${sample.slug}`;
    const existing = await db.product.findUnique({
      where: { id },
      include: { media: true },
    });
    if (existing && !existing.isDemo)
      throw Error(`Refusing to modify a non-demo product: ${id}`);
    if (existing) {
      await db.product.update({
        where: { id },
        data: { published: true, archived: false },
      });
      if (existing.media.length) {
        console.log(`Restored ${existing.name}; existing edits retained.`);
        continue;
      }
    }
    const categorySlug = sample.category.toLowerCase().replaceAll(" ", "-");
    const category =
      (await db.category.findFirst({
        where: { OR: [{ name: sample.category }, { slug: categorySlug }] },
      })) ||
      (await db.category.create({
        data: { name: sample.category, slug: categorySlug },
      }));
    const mediaIds: string[] = [];
    for (const filename of [sample.image, sample.detail].filter(
      (name): name is string => Boolean(name),
    )) {
      const key = `/images/products/${filename}.webp`;
      const file = await stat(path.join(process.cwd(), "public", key));
      const asset = await db.mediaAsset.upsert({
        where: { key },
        create: {
          provider: "demo",
          kind: "image",
          purpose: "product",
          key,
          filename: `${filename}.webp`,
          mime: "image/webp",
          bytes: BigInt(file.size),
          state: "ready",
        },
        update: {},
      });
      if (asset.provider !== "demo")
        throw Error("Refusing to reuse non-demo media as test imagery.");
      mediaIds.push(asset.id);
    }
    const collision = await db.product.findUnique({
      where: { slug: sample.slug },
    });
    const slug =
      collision && collision.id !== id ? `demo-${sample.slug}` : sample.slug;
    await db.$transaction(async (tx) => {
      await tx.product.upsert({
        where: { id },
        create: {
          id,
          slug,
          name: sample.name,
          description: `DEMO / TEST INVENTORY — Illustrative images, sample pricing and specifications; not actual RK Luxmnl stock.\n\n${sample.description}`,
          categoryId: category.id,
          price: sample.price,
          availability: "Available",
          isDemo: true,
          ownerConfirmed: false,
          published: true,
          specifications: {
            metal: "18K gold (demo specification)",
            gemstone:
              sample.category === "Gemstone Jewelry"
                ? "Gemstone design concept (demo)"
                : "Diamond design concept (demo)",
          },
          media: {
            create: mediaIds.map((assetId, position) => ({
              assetId,
              position,
            })),
          },
        },
        update: {
          media: {
            create: mediaIds.map((assetId, position) => ({
              assetId,
              position,
            })),
          },
        },
      });
    });
    console.log(`Restored ${sample.name}.`);
  }
  console.log(
    "Eight demo products restored. Set ENABLE_DEMO_CATALOG=false and rebuild/restart to hide all demo inventory.",
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
