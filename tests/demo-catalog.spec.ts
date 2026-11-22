import { test, expect, request } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID, randomBytes } from "node:crypto";
import { stat } from "node:fs/promises";
import { passwordHash } from "../src/lib/security";
import { publicProductWhere } from "../src/lib/public-products";

test("demo inventory can be edited when enabled without becoming confirmed real stock", async () => {
  test.skip(
    process.env.ENABLE_DEMO_CATALOG !== "true",
    "Enable demo mode on the isolated test server for this test.",
  );
  if (!new URL(process.env.DATABASE_URL || "").pathname.endsWith("_test"))
    throw Error("Use an isolated test database.");
  const db = new PrismaClient();
  const suffix = randomUUID();
  const email = `demo-${suffix}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  const category = await db.category.create({
    data: { name: `Demo test ${suffix}`, slug: `demo-test-${suffix}` },
  });
  const user = await db.adminUser.create({
    data: { email, passwordHash: await passwordHash(password) },
  });
  const key = "/images/products/solitaire-diamond-ring-detail.webp";
  const existing = await db.mediaAsset.findUnique({ where: { key } });
  const asset =
    existing ||
    (await db.mediaAsset.create({
      data: {
        provider: "demo",
        purpose: "product",
        kind: "image",
        state: "ready",
        key,
        filename: "solitaire-diamond-ring-detail.webp",
        mime: "image/webp",
        bytes: BigInt((await stat(`public${key}`)).size),
      },
    }));
  const product = await db.product.create({
    data: {
      name: "Isolated demo edit test",
      slug: `demo-edit-${suffix}`,
      categoryId: category.id,
      isDemo: true,
      ownerConfirmed: false,
    },
  });
  const base = process.env.APP_URL || "http://localhost:3002";
  const client = await request.newContext({
    baseURL: base,
    extraHTTPHeaders: { Origin: base },
  });
  try {
    expect(
      (
        await client.post("/api/auth/login", { data: { email, password } })
      ).ok(),
    ).toBeTruthy();
    const payload = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      categoryId: category.id,
      price: 48500,
      description: "Demonstration-only inventory.",
      availability: "Available",
      published: true,
      ownerConfirmed: false,
      mediaIds: [asset.id],
      specifications: { metal: "Demo metal" },
      policies: {},
    };
    const saved = await client.post("/api/admin/products", { data: payload });
    expect(saved.ok(), await saved.text()).toBeTruthy();
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: product.id } }))
        .ownerConfirmed,
    ).toBe(false);
    const catalog = await (await client.get("/api/catalog")).json();
    expect(
      catalog.products.some(
        (p: { id: string; isDemo: boolean }) => p.id === product.id && p.isDemo,
      ),
    ).toBeTruthy();
    const changed = await client.post("/api/admin/products", {
      data: { ...payload, price: 49500 },
    });
    expect(changed.ok(), await changed.text()).toBeTruthy();
    expect(
      Number(
        (await db.product.findUniqueOrThrow({ where: { id: product.id } }))
          .price,
      ),
    ).toBe(49500);
    const imageRedirect = await client.get(`/api/media/${asset.id}`, {
      maxRedirects: 0,
    });
    expect(imageRedirect.headers().location).toBe(key);
    expect((await client.get(`/api/media/${asset.id}`)).status()).toBe(200);
    const real = await client.post("/api/admin/products", {
      data: {
        ...payload,
        id: undefined,
        slug: `real-${suffix}`,
        ownerConfirmed: true,
      },
    });
    expect(real.status()).toBe(400);
    const previous = process.env.ENABLE_DEMO_CATALOG;
    try {
      process.env.ENABLE_DEMO_CATALOG = "false";
      expect(
        await db.product.count({
          where: { ...publicProductWhere(), id: product.id },
        }),
      ).toBe(0);
    } finally {
      if (previous === undefined) delete process.env.ENABLE_DEMO_CATALOG;
      else process.env.ENABLE_DEMO_CATALOG = previous;
    }
  } finally {
    await client.dispose();
    await db.product.delete({ where: { id: product.id } });
    await db.adminUser.delete({ where: { id: user.id } });
    if (!existing) await db.mediaAsset.delete({ where: { id: asset.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.$disconnect();
  }
});
