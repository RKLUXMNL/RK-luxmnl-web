import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { db } from "../src/lib/db";
import { defaults } from "../src/lib/settings";
async function main() {
  for (const name of [
    "Diamond Rings",
    "Necklaces and Pendants",
    "Earrings",
    "Bracelets",
    "Gemstone Jewelry",
    "Other Jewelry",
  ])
    await db.category.upsert({
      where: { name },
      update: {},
      create: { name, slug: name.toLowerCase().replaceAll(" ", "-") },
    });
  await db.websiteSettings.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main", data: defaults },
  });
  console.log(
    "Business settings and categories initialized. No inventory, prices or appointments fabricated.",
  );
  await db.$disconnect();
}
main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exitCode = 1;
});
