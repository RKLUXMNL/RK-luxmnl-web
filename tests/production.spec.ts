import {
  test,
  expect,
  request as createRequest,
  APIRequestContext,
  Page,
} from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { passwordHash } from "../src/lib/security";
import { defaults } from "../src/lib/settings";
import { manilaDate, manilaLabel } from "../src/lib/manila";
const database = new PrismaClient();
const base = process.env.APP_URL || "http://localhost:3002";
const email = "integration-admin@example.invalid",
  password = randomBytes(24).toString("hex");
let admin: APIRequestContext,
  anon: APIRequestContext,
  categoryId: string,
  productId: string,
  secondId: string,
  draftId: string,
  storyId: string,
  draftStoryId: string,
  images: string[];
type Upload = { assetId: string; token: string; url: string };
type SharedPayload = {
  text?: string;
  title?: string;
  files?: { name: string; type: string; size: number }[];
};
async function post(resource: string, data: unknown) {
  const result = await admin.post(`/api/admin/${resource}`, { data });
  expect(result.ok(), await result.text()).toBeTruthy();
  return result.json();
}
async function upload(
  client: APIRequestContext,
  purpose: string,
  buffer: Buffer,
  mime = "image/jpeg",
  authorized = false,
) {
  const response = await client.post("/api/uploads", {
    data: {
      action: "authorize",
      purpose,
      provider: "object",
      filename: `test-${randomUUID()}.${mime === "video/webm" ? "webm" : "jpg"}`,
      mime,
      bytes: buffer.length,
      authorized,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const auth = (await response.json()) as Upload;
  const put = await client.put(auth.url, {
    headers: { "Content-Type": mime },
    data: buffer,
  });
  expect(put.ok(), await put.text()).toBeTruthy();
  const finish = await client.post("/api/uploads", {
    data: { action: "finish", id: auth.assetId, token: auth.token },
  });
  expect(finish.ok(), await finish.text()).toBeTruthy();
  return auth;
}
function product(
  name: string,
  price: number | null,
  published = true,
  extra: Record<string, unknown> = {},
) {
  return {
    name,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    categoryId,
    price,
    description: "A verified test-only description.\nSecond paragraph.",
    availability: "Available",
    published,
    ownerConfirmed: published,
    mediaIds: images,
    specifications: { metal: "Test-approved metal", size: "" },
    policies: {},
    authenticityEnabled: false,
    ...extra,
  };
}
async function loginPage(page: Page) {
  if (!page.url().endsWith("/admin/login")) await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
}
test.beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL || "").pathname.endsWith("_test"))
    throw Error("Integration tests require an isolated _test database.");
  await database.$executeRawUnsafe(
    'TRUNCATE "AdminUser", "Category", "MediaAsset", "WebsiteSettings", "RateLimit", "AppointmentSlot", "BlockedDate", "Inquiry", "CustomizationRequest", "LiveSellingSession", "Reel", "SparkleStory" CASCADE',
  );
  await database.adminUser.create({
    data: { email, passwordHash: await passwordHash(password) },
  });
  await database.websiteSettings.create({
    data: { id: "main", data: defaults },
  });
  const category = await database.category.create({
    data: { name: "Diamond Rings", slug: "diamond-rings" },
  });
  categoryId = category.id;
  const saleCategory = await database.category.create({
    data: { name: "Sale", slug: "sale" },
  });
  admin = await createRequest.newContext({
    baseURL: base,
    extraHTTPHeaders: { Origin: base },
  });
  anon = await createRequest.newContext({
    baseURL: base,
    extraHTTPHeaders: { Origin: base },
  });
  const login = await admin.post("/api/auth/login", {
    data: { email, password },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  const photo = await readFile("public/ring.jpg");
  images = [
    (await upload(admin, "product", photo)).assetId,
    (await upload(admin, "product", await readFile("public/solitaire.jpg")))
      .assetId,
  ];
  productId = (await post("products", product("Test Solitaire", 10000))).id;
  secondId = (await post("products", product("Test Trilogy", 50000))).id;
  await post("products", product("Test Inquiry Ring", null));
  await post(
    "products",
    product("Live Sale Ring", 48000, true, {
      placement: "LIVE",
      originalPrice: 50000,
      categoryIds: [saleCategory.id],
      specifications: {
        metal: "Japan setting",
        weight: "18k gold 14g",
      },
    }),
  );
  draftId = (await post("products", product("Private Draft Ring", 123, false)))
    .id;
  storyId = (
    await post("stories", {
      customerName: "Maya from Makati",
      platform: "Instagram",
      message: "The halo setting is even more beautiful in person.",
      sourceUrl: "https://www.instagram.com/p/test-sparkle-story/",
      published: true,
    })
  ).id;
  draftStoryId = (
    await post("stories", {
      customerName: "Unpublished Client",
      platform: "Facebook",
      message: "This private draft must never appear on the public site.",
      sourceUrl: "",
      published: false,
    })
  ).id;
});
test.beforeEach(async () => {
  await database.rateLimit.deleteMany();
});
test.afterAll(async () => {
  await admin?.dispose();
  await anon?.dispose();
  await database.$disconnect();
});

test("authentication, server authorization, CSRF and session invalidation", async ({
  page,
  request,
}) => {
  expect((await anon.get("/api/admin/data")).status()).toBe(401);
  expect(
    (await request.post(`${base}/api/admin/settings`, { data: {} })).status(),
  ).toBe(403);
  expect(
    (
      await anon.post("/api/auth/login", {
        headers: { Origin: "https://untrusted.example" },
        data: { email, password },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await anon.post("/api/auth/login", {
        data: { email, password: "incorrect" },
      })
    ).status(),
  ).toBe(401);
  await page.goto("/admin");
  await expect(page).toHaveURL(/admin\/login/);
  await loginPage(page);
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === "rk_session");
  expect(session?.httpOnly).toBeTruthy();
  expect(session?.sameSite).toBe("Strict");
  expect((await page.request.get("/api/admin/data")).status()).toBe(200);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/admin\/login/);
  expect((await page.request.get("/api/admin/data")).status()).toBe(401);
});

test("admin accepts a product with only its primary category", async () => {
  const response = await admin.post("/api/admin/products", {
    data: {
      ...product("Test Single Category Ring", 1234, false),
      categoryIds: [],
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const created = await response.json();
  expect(created.categoryId).toBe(categoryId);
});

test("admin product search covers product fields and is returned with admin data", async () => {
  for (const query of ["Live Sale", "50,000", "Japan setting", "Diamond Rings"]) {
    const response = await admin.get(
      `/api/admin/data?productQuery=${encodeURIComponent(query)}`,
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    const data = await response.json();
    expect(data.productQuery).toBe(query);
    expect(data.products.map((item: { name: string }) => item.name)).toContain(
      "Live Sale Ring",
    );
  }
  const response = await admin.get(
    "/api/admin/data?productQuery=No Such Product",
  );
  const data = await response.json();
  expect(data.products).toHaveLength(0);
});

test("stories are validated, managed in admin and published selectively", async ({
  page,
}) => {
  const invalid = await admin.post("/api/admin/stories", {
    data: {
      customerName: "Mismatched Link",
      platform: "Instagram",
      message: "This source link belongs to another platform.",
      sourceUrl: "https://www.facebook.com/rkluxmnl",
      published: true,
    },
  });
  expect(invalid.status()).toBe(400);
  const data = await (await admin.get("/api/admin/data")).json();
  expect(data.stories).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: storyId,
        customerName: "Maya from Makati",
        published: true,
      }),
      expect.objectContaining({
        id: draftStoryId,
        published: false,
      }),
    ]),
  );
  const publicPage = await anon.get("/stories-of-sparkle");
  expect(publicPage.ok(), await publicPage.text()).toBeTruthy();
  const html = await publicPage.text();
  expect(html).toContain("The halo setting is even more beautiful in person.");
  expect(html).not.toContain("This private draft must never appear");
  await loginPage(page);
  await page.getByRole("button", { name: "Stories of Sparkle", exact: true }).click();
  await page.getByRole("button", { name: "Add story", exact: true }).click();
  await page.getByLabel("Customer name", { exact: true }).fill("Admin Test Client");
  await page.getByLabel("Platform", { exact: true }).selectOption("Facebook");
  await page
    .getByLabel("Feedback message", { exact: true })
    .fill("The custom necklace became an heirloom piece for our family.");
  await page
    .getByLabel("Source post URL (optional)", { exact: true })
    .fill("https://www.facebook.com/rkluxmnl");
  await page.getByLabel("Publish on Stories of Sparkle").check();
  await page.getByRole("button", { name: "Save story", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Admin Test Client", exact: true }),
  ).toBeVisible();
  await page.goto("/stories-of-sparkle");
  await expect(
    page.getByText(
      "The custom necklace became an heirloom piece for our family.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page
      .locator(".story-card")
      .filter({
        hasText: "The custom necklace became an heirloom piece for our family.",
      })
      .getByRole("link", { name: /View original/i }),
  ).toHaveAttribute("href", "https://www.facebook.com/rkluxmnl");
});

test("admin printable selection shows full product details behind login", async ({
  page,
}) => {
  const printed = await admin.get(`/admin/print?ids=${productId}`);
  expect(printed.ok(), await printed.text()).toBeTruthy();
  const html = await printed.text();
  expect(html).toContain("Test Solitaire");
  expect(html).toContain("₱10,000.00");
  expect(html).toContain("Test-approved metal");
  expect(html).toContain("Specifications");
  expect([302, 307]).toContain(
    (await anon.get(`/admin/print?ids=${productId}`, { maxRedirects: 0 }))
      .status(),
  );
  await loginPage(page);
  await page.getByRole("button", { name: "Products", exact: true }).click();
  await page.getByLabel("Search admin products").fill("Live Sale Ring");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Live Sale Ring", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit Test Solitaire", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Select Live Sale Ring for printing").check();
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: /Print selected/ }).click(),
  ]);
  await expect(popup).toHaveURL(/\/admin\/print\?ids=/);
  await expect(
    popup.getByRole("heading", { name: "Live Sale Ring", exact: true }),
  ).toBeVisible();
  await expect(
    popup.getByText("Japan setting", { exact: true }),
  ).toBeVisible();
});

test("published-only details, actual specifications, galleries, zoom, accordions and inline inquiry", async ({
  page,
}) => {
  expect((await anon.get("/products/private-draft-ring")).status()).toBe(404);
  const illegal = await admin.post("/api/admin/products", {
    data: {
      ...product("Unapproved Published Ring", 85000),
      ownerConfirmed: false,
    },
  });
  expect(illegal.status()).toBe(400);
  await page.goto("/products/test-solitaire");
  await expect(
    page.getByRole("heading", { name: "Test Solitaire", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("₱10,000.00", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Test-approved metal", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Size", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Payment Methods", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Return & Exchange Policy", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "View photo 2", exact: true }).click();
  await expect(page.locator(".gallery-main img")).toHaveAttribute(
    "src",
    `/api/media/${images[1]}`,
  );
  await page.getByRole("button", { name: "Enlarge product image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Toggle image zoom" }).click();
  await expect(page.locator(".zoom-surface")).toHaveClass(/zoomed/);
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Close fullscreen gallery" }).click();
  await page
    .getByRole("button", { name: "Delivery Options", exact: true })
    .click();
  await expect(
    page.getByText(defaults.policies.delivery!, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Product Description", exact: true })
    .click();
  await expect(
    page.locator(".accordion-content").filter({ hasText: "Second paragraph." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "INQUIRE ON THIS ITEM", exact: false })
    .click();
  await page
    .getByLabel("Customer name", { exact: true })
    .fill("Inline Customer");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("inline@example.invalid");
  await page.getByLabel("Contact number", { exact: true }).fill("09171234567");
  await page
    .getByLabel("Message / questions", { exact: true })
    .fill("Please tell me more about this ring.");
  await page.getByRole("button", { name: "Send inquiry", exact: false }).click();
  await expect(
    page.getByText("Your inquiry has been received."),
  ).toBeVisible();
  expect(
    await database.inquiry.count({
      where: { email: "inline@example.invalid", productId },
    }),
  ).toBe(1);
  expect(await page.locator("link[rel=canonical]").getAttribute("href")).toBe(
    `${base}/products/test-solitaire`,
  );
  await expect(
    page.getByRole("link", { name: /Send on Instagram/ }),
  ).toHaveAttribute("href", defaults.instagram);
  await expect(
    page.getByRole("link", { name: /Send on Facebook/ }),
  ).toHaveAttribute("href", defaults.facebook);
  expect(
    (await anon.get("/shop/test-solitaire", { maxRedirects: 0 })).status(),
  ).toBe(308);
});

test("related products rank matching descriptions and carat titles first", async ({
  page,
}) => {
  const created = [
    await post(
      "products",
      product(
        "1.0ct Halo Ring",
        100000,
        true,
        {
          slug: "one-ct-halo-ring",
          description: "A 1.0ct halo ring with a natural diamond center.",
          specifications: { carat: "1.0", metal: "Test-approved metal" },
        },
      ),
    ),
    await post(
      "products",
      product(
        "1.0 ct Halo Ring",
        105000,
        true,
        {
          slug: "one-ct-halo-related",
          description: "A 1.0 ct halo ring with a natural diamond center.",
          specifications: { carat: "1.0", metal: "Test-approved metal" },
        },
      ),
    ),
    await post(
      "products",
      product(
        "2.0ct Solitaire Ring",
        200000,
        true,
        {
          slug: "two-ct-solitaire-ring",
          description: "A 2.0ct solitaire ring with a natural diamond center.",
          specifications: { carat: "2.0", metal: "Test-approved metal" },
        },
      ),
    ),
  ];
  try {
    await page.goto(`/products/${created[0].slug}`);
    const related = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", {
          name: "You May Also Like",
          exact: true,
        }),
      })
      .locator(".product-card h3");
    await expect(related.first()).toHaveText("1.0 ct Halo Ring");
    expect(await related.allTextContents()).not.toContain("1.0ct Halo Ring");
  } finally {
    await database.product.deleteMany({
      where: { id: { in: created.map((row) => row.id as string) } },
    });
  }
});

test("catalog search, derived dual range, inquiry-only pricing, sorting and reset", async ({
  page,
}) => {
  expect((await anon.get("/shop", { maxRedirects: 0 })).status()).toBe(308);
  await page.goto("/showroom");
  await expect(page.locator(".product-card")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Save Test Solitaire", exact: true })
    .click();
  await page.goto("/wishlist");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".product-card h3")).toHaveText("Test Solitaire");
  await page.goto("/showroom");
  await expect(
    page.getByRole("slider", { name: "Minimum price" }),
  ).toHaveAttribute("aria-valuemin", "10000");
  await expect(
    page.getByRole("slider", { name: "Maximum price" }),
  ).toHaveAttribute("aria-valuemax", "50000");
  await page
    .getByLabel("Maximum price", { exact: true })
    .filter({ hasNot: page.locator("[role=slider]") })
    .count();
  await page.locator("input[type=number]").last().fill("20000");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator(".product-card h3")).toHaveText("Test Solitaire");
  await page.getByLabel("Pricing", { exact: true }).selectOption("inquiry");
  await expect(page.locator(".product-card h3")).toHaveText(
    "Test Inquiry Ring",
  );
  await page.getByRole("button", { name: "Reset Filters" }).click();
  await expect(page.locator(".product-card")).toHaveCount(3);
  await page.getByRole("searchbox").fill("Trilogy");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.getByRole("link", { name: "View details", exact: true }).click();
  await expect(page).toHaveURL(/products\/test-trilogy/);
});

test("showroom category persists through product links, breadcrumbs and browser back", async ({
  page,
}) => {
  await page.goto("/showroom");
  await page
    .getByRole("button", { name: "Diamond Rings", exact: true })
    .click();
  await expect(page).toHaveURL(/category=Diamond/);
  await expect(page.locator(".filter-chips button.selected")).toHaveText(
    "Diamond Rings",
  );
  await page.getByRole("link", { name: "View details", exact: true }).first().click();
  await expect(page).toHaveURL(/products\/.*category=Diamond/);
  await page
    .locator(".breadcrumb")
    .getByRole("link", { name: "The collection", exact: true })
    .click();
  await expect(page).toHaveURL(/showroom\?category=Diamond/);
  await expect(page.locator(".filter-chips button.selected")).toHaveText(
    "Diamond Rings",
  );
  await page.getByRole("link", { name: "View details", exact: true }).first().click();
  await expect(page).toHaveURL(/products\/.*category=Diamond/);
  await page.goBack();
  await expect(page).toHaveURL(/showroom\?category=Diamond/);
  await expect(page.locator(".filter-chips button.selected")).toHaveText(
    "Diamond Rings",
  );
});

test("showroom search covers live products, details, prices, sale and live badges", async ({
  page,
}) => {
  await page.goto("/showroom");
  await expect(page.locator(".product-card")).toHaveCount(3);
  await page.getByRole("searchbox").fill("Japan");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator(".product-card h3")).toHaveText("Live Sale Ring");
  await expect(page.locator(".live-card-tag")).toHaveText("LIVE");
  await expect(page.locator(".sale-card-tag")).toHaveText("ON SALE");
  await expect(page.locator(".product-price s")).toContainText("50,000.00");
  await page.getByRole("searchbox").fill("48000");
  await expect(page.locator(".product-card h3")).toHaveText("Live Sale Ring");
  await page.getByRole("searchbox").fill("14g");
  await expect(page.locator(".product-card h3")).toHaveText("Live Sale Ring");
  await page.goto("/products/live-sale-ring");
  await expect(page.locator(".detail-price s")).toContainText("50,000.00");
  await expect(page.getByText("ON SALE", { exact: true })).toBeVisible();
  await expect(page.getByText("LIVE", { exact: true })).toBeVisible();
  await page.goto("/live-selling");
  await expect(
    page.getByRole("heading", { name: "Live products", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(1);
});

test("persistent inquiries, idempotency, validation, social contact and admin status", async ({
  page,
}) => {
  const submissionKey = randomUUID();
  const data = {
    name: "Persistent Customer",
    email: "persist@example.invalid",
    mobile: "+639171234567",
    message: "May I request a video of this item?",
    platform: "Facebook",
    productId,
    submissionKey,
    website: "",
  };
  const first = await anon.post("/api/requests/inquiry", { data });
  expect(first.status()).toBe(201);
  const short = await anon.post("/api/requests/inquiry", {
    data: {
      ...data,
      submissionKey: randomUUID(),
      message: "How much is this?",
    },
  });
  expect(short.status()).toBe(201);
  const empty = await anon.post("/api/requests/inquiry", {
    data: { ...data, submissionKey: randomUUID(), message: "   " },
  });
  expect(empty.status()).toBe(400);
  const second = await anon.post("/api/requests/inquiry", { data });
  expect(second.status()).toBe(200);
  expect((await first.json()).id).toBe((await second.json()).id);
  expect(await database.inquiry.count({ where: { submissionKey } })).toBe(1);
  expect(
    (
      await anon.post("/api/requests/inquiry", {
        data: { ...data, submissionKey: randomUUID(), website: "spam" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await anon.post("/api/requests/inquiry", {
        data: { ...data, submissionKey: randomUUID(), productId: draftId },
      })
    ).status(),
  ).toBe(400);
  await page.addInitScript(() => {
    (window as Window & { __sharedPayloads?: unknown[] }).__sharedPayloads = [];
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (data: ShareData) => Boolean(data.files?.length || data.text),
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (data: ShareData) => {
        (
          window as Window & { __sharedPayloads?: unknown[] }
        ).__sharedPayloads?.push({
          text: data.text,
          title: data.title,
          files: data.files?.map((file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
          })),
        });
        return Promise.resolve();
      },
    });
  });
  await page.goto("/products/test-solitaire");
  await page
    .getByRole("button", { name: "INQUIRE ON THIS ITEM", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Customer name").fill("Modal Customer");
  await page.getByLabel("Email address").fill("modal@example.invalid");
  await page.getByLabel("Contact number").fill("+639171234567");
  await page.getByLabel("Message / questions").fill("How much is this?");
  await page
    .getByRole("button", { name: "Send inquiry", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your inquiry has been received." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open Instagram" }),
  ).toHaveAttribute("href", defaults.instagram);
  await expect(
    page.getByRole("link", { name: "Open Facebook", exact: true }),
  ).toHaveAttribute("href", defaults.facebook);
  const share = page.getByRole("button", { name: "Share message + photo" });
  await expect(share).toBeVisible();
  await share.click();
  const shared = await page.evaluate(
    () =>
      (window as Window & { __sharedPayloads?: SharedPayload[] })
        .__sharedPayloads ?? [],
  );
  expect(shared).toHaveLength(1);
  expect(shared[0].text).toContain("How much is this?");
  expect(shared[0].title).toBe("Test Solitaire inquiry");
  expect(shared[0].files).toEqual([
    { name: "test-solitaire.png", type: "image/png", size: shared[0].files?.[0]?.size },
  ]);
  expect(shared[0].files?.[0]?.size).toBeGreaterThan(0);
  const row = await database.inquiry.findFirstOrThrow({
    where: { submissionKey },
  });
  await post("inquiries", { id: row.id, status: "Contacted" });
  expect(
    (await database.inquiry.findUniqueOrThrow({ where: { id: row.id } }))
      .status,
  ).toBe("Contacted");
});

test("inquiry keeps copy and social fallbacks without native sharing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto("/products/test-solitaire");
  await page
    .getByRole("button", { name: "INQUIRE ON THIS ITEM", exact: true })
    .click();
  await page.getByLabel("Customer name").fill("Fallback Customer");
  await page.getByLabel("Email address").fill("fallback@example.invalid");
  await page.getByLabel("Contact number").fill("+639171234567");
  await page.getByLabel("Message / questions").fill("Is this still available?");
  await page
    .getByRole("button", { name: "Send inquiry", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your inquiry has been received." }),
  ).toBeVisible();
  expect(
    await page.getByRole("button", { name: "Share message" }).count(),
  ).toBe(0);
  await expect(
    page.getByRole("button", { name: "Copy message" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy photo" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open Instagram" }),
  ).toBeVisible();
});

test("appointment locking, pending state, cancellation release and blocked dates", async () => {
  const startsAt = new Date(Date.now() + 2 * 86400000).toISOString();
  const slot = await post("slots", { startsAt, capacity: 1, enabled: true });
  const booking = {
    name: "Viewing Customer",
    email: "viewing@example.invalid",
    mobile: "+639171234567",
    message: "A personal jewelry consultation.",
    type: "Jewelry Viewing",
    location: defaults.location,
    slotId: slot.id,
    productId,
    website: "",
  };
  const responses = await Promise.all([
    anon.post("/api/requests/viewing", {
      data: { ...booking, submissionKey: randomUUID() },
    }),
    anon.post("/api/requests/viewing", {
      data: { ...booking, submissionKey: randomUUID() },
    }),
  ]);
  expect(responses.map((r) => r.status()).sort()).toEqual([201, 409]);
  const pending = await database.appointment.findFirstOrThrow({
    where: { slotId: slot.id },
  });
  expect(pending.status).toBe("Pending");
  expect(
    (await (await anon.get("/api/availability")).json()).some(
      (s: { id: string }) => s.id === slot.id,
    ),
  ).toBeFalsy();
  await post("appointments", { id: pending.id, status: "Cancelled" });
  expect(
    (await (await anon.get("/api/availability")).json()).some(
      (s: { id: string }) => s.id === slot.id,
    ),
  ).toBeTruthy();
  await post("blocked", {
    date: manilaDate(startsAt),
    reason: "Owner unavailable",
  });
  expect(
    (
      await anon.post("/api/requests/viewing", {
        data: { ...booking, submissionKey: randomUUID() },
      })
    ).status(),
  ).toBe(409);
  await admin.delete("/api/admin/blocked", {
    data: { id: manilaDate(startsAt) },
  });
});

test("private persistent customization reference upload and public access denial", async ({
  page,
}) => {
  const reference = await upload(
    anon,
    "custom",
    await readFile("public/ring.jpg"),
  );
  expect(
    (
      await anon.get(`/api/media/${reference.assetId}`, { maxRedirects: 0 })
    ).status(),
  ).toBe(404);
  const payload = {
    name: "Bespoke Customer",
    email: "bespoke@example.invalid",
    mobile: "+639171234567",
    message: "An oval ring with a personal design.",
    jewelry: "Ring",
    metal: "Preferred metal",
    gemstone: "Preferred gemstone",
    budget: "To discuss",
    references: [{ id: reference.assetId, token: reference.token }],
    submissionKey: randomUUID(),
    website: "",
  };
  const response = await anon.post("/api/requests/custom", { data: payload });
  expect(response.status(), await response.text()).toBe(201);
  expect(
    await database.customReference.count({
      where: { assetId: reference.assetId },
    }),
  ).toBe(1);
  expect((await anon.get(`/api/media/${reference.assetId}`)).status()).toBe(
    404,
  );
  expect((await admin.get(`/api/media/${reference.assetId}`)).status()).toBe(
    200,
  );
  await page.goto("/customization");
  await page
    .getByLabel("Upload file", { exact: true })
    .setInputFiles("public/solitaire.jpg");
  await expect(page.getByAltText("Selected upload preview")).toBeVisible();
  await page.getByRole("button", { name: "Upload selected file" }).click();
  await expect(page.getByText("Reference 1 uploaded securely")).toBeVisible();
  await page
    .getByLabel("Design description")
    .fill("A securely uploaded custom ring design request.");
  await page.getByLabel("Customer name").fill("Browser Bespoke");
  await page
    .getByLabel("Email address")
    .fill("browser-bespoke@example.invalid");
  await page.getByLabel("Contact number").fill("+639171234567");
  await page.getByRole("button", { name: "Submit my design request" }).click();
  await expect(
    page.getByRole("heading", { name: "Your vision starts here." }),
  ).toBeVisible();
  expect(
    await database.customizationRequest.count({
      where: { email: "browser-bespoke@example.invalid" },
    }),
  ).toBe(1);
});

test("live calendar, Instagram and Facebook redirects, replay fallback and shared catalog associations", async ({
  page,
}) => {
  const startsAt = new Date().toISOString();
  const live = await post("sessions", {
    title: "Test Live Session",
    startsAt,
    description: "Published session fixture.",
    status: "Live Now",
    instagramUrl: defaults.instagram,
    facebookUrl: "",
    published: true,
    replayId: null,
    products: [{ productId, timestamp: 10 }],
  });
  await page.goto("/live-selling");
  await expect(
    page.getByRole("heading", { name: "Test Live Session" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Watch Live on Instagram" }),
  ).toHaveAttribute("href", defaults.instagram);
  await expect(
    page.getByRole("link", { name: "Watch Live on Facebook" }),
  ).toHaveCount(0);
  const facebookLive = {
    id: live.id,
    title: live.title,
    startsAt,
    description: live.description,
    status: "Live Now",
    instagramUrl: "",
    facebookUrl: defaults.facebook,
    published: true,
    replayId: null,
    products: [{ productId, timestamp: 10 }],
  };
  await post("sessions", facebookLive);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Watch Live on Facebook" }),
  ).toHaveAttribute("href", defaults.facebook);
  await expect(
    page.getByRole("link", { name: "Watch Live on Instagram" }),
  ).toHaveCount(0);
  await post("sessions", { ...facebookLive, status: "Completed" });
  await page.reload();
  await expect(page.getByText("Replay not available yet.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Jewelry Featured During This Live" }),
  ).toBeVisible();
  await expect(page.locator(".live-session .product-card")).toHaveCount(1);
  await page
    .locator(".live-session")
    .getByRole("link", { name: "View details" })
    .click();
  await expect(page).toHaveURL(/products\/test-solitaire/);
  const processing = await database.mediaAsset.create({
    data: {
      provider: "stream",
      kind: "video",
      purpose: "live",
      key: `unverified-provider-fixture-${randomUUID()}`,
      filename: "processing.mp4",
      mime: "video/mp4",
      bytes: BigInt(1000),
      state: "processing",
    },
  });
  const invalid = await admin.post("/api/admin/sessions", {
    data: {
      id: live.id,
      title: live.title,
      startsAt,
      description: "",
      status: "Completed",
      instagramUrl: "",
      facebookUrl: "",
      published: true,
      replayId: processing.id,
      products: [],
    },
  });
  expect(invalid.status()).toBe(400);
  const invalidPlatform = await admin.post("/api/admin/sessions", {
    data: {
      ...facebookLive,
      facebookUrl: "https://example.com/live",
    },
  });
  expect(invalidPlatform.status()).toBe(400);
});

test("live session preview media is private until publication and shown on its calendar date", async ({
  page,
}) => {
  const photo = await upload(admin, "live", await readFile("public/ring.jpg"));
  const still =
    await upload(admin, "live", await readFile("public/solitaire.jpg"));
  await page.goto("/");
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#c9973b";
    context.fillRect(0, 0, 64, 64);
    const stream = canvas.captureStream(5);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: BlobPart[] = [];
    const done = new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    });
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 800));
    recorder.stop();
    const video = await done;
    stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await video.arrayBuffer()));
  });
  const trailer = await upload(
    admin,
    "live",
    Buffer.from(bytes),
    "video/webm",
  );
  const startsAt = new Date(Date.now() + 10 * 86400000).toISOString();
  const date = manilaDate(startsAt);
  const session = {
    title: "Preview Session",
    startsAt,
    description: "Published preview fixture.",
    status: "Scheduled",
    instagramUrl: "",
    facebookUrl: "",
    published: false,
    replayId: null,
    thumbnailId: photo.assetId,
    trailerId: trailer.assetId,
    products: [],
  };
  const draft = await post("sessions", session);
  await post("sessions", {
    ...session,
    id: undefined,
    title: "Photo Preview Session",
    thumbnailId: still.assetId,
    trailerId: null,
    published: true,
  });
  for (const id of [photo.assetId, trailer.assetId]) {
    expect((await anon.get(`/api/media/${id}`, { maxRedirects: 0 })).status())
      .toBe(404);
  }
  const wrongKind = await admin.post("/api/admin/sessions", {
    data: { ...session, id: undefined, thumbnailId: trailer.assetId, trailerId: photo.assetId },
  });
  expect(wrongKind.status()).toBe(400);
  const processing = await database.mediaAsset.create({
    data: {
      provider: "object",
      kind: "image",
      purpose: "live",
      key: `live-preview-processing-${randomUUID()}`,
      filename: "processing.jpg",
      mime: "image/jpeg",
      bytes: BigInt(1000),
      state: "processing",
    },
  });
  const unpublishedAsset = await admin.post("/api/admin/sessions", {
    data: {
      ...session,
      id: undefined,
      published: true,
      thumbnailId: processing.id,
      trailerId: null,
    },
  });
  expect(unpublishedAsset.status()).toBe(400);
  await post("sessions", { ...session, id: draft.id, published: true });
  for (const id of [photo.assetId, trailer.assetId]) {
    expect((await anon.get(`/api/media/${id}`, { maxRedirects: 0 })).status())
      .toBe(302);
  }
  expect(
    (
      await admin.post("/api/uploads", {
        data: { action: "delete", id: photo.assetId },
      })
    ).status(),
  ).toBe(409);
  await page.goto("/live-selling");
  for (let i = 0; i < 2; i++) {
    if (await page.getByRole("button", { name: date, exact: true }).count())
      break;
    await page.getByRole("button", { name: "Next month" }).click();
  }
  await page.getByRole("button", { name: date, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Preview Session", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Photo Preview Session" }),
  ).toBeVisible();
  await expect(page.locator(".live-preview video")).toHaveAttribute(
    "src",
    `/api/media/${trailer.assetId}`,
  );
  await expect(page.locator(".live-preview video")).toHaveAttribute(
    "poster",
    `/api/media/${photo.assetId}?w=720`,
  );
  await expect(page.locator(".live-preview-image")).toHaveAttribute(
    "src",
    `/api/media/${still.assetId}?w=720`,
  );
  await post("sessions", { ...session, id: draft.id, published: false });
  expect((await anon.get(`/api/media/${photo.assetId}`, { maxRedirects: 0 })).status())
    .toBe(404);
  await page.reload();
  for (let i = 0; i < 2; i++) {
    if (await page.getByRole("button", { name: date, exact: true }).count())
      break;
    await page.getByRole("button", { name: "Next month" }).click();
  }
  await page.getByRole("button", { name: date, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Preview Session", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Photo Preview Session" }),
  ).toBeVisible();
});

test("authorized original Reel upload, native playback and download permission enforcement", async ({
  page,
}) => {
  await page.goto("/");
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#c9973b";
    context.fillRect(0, 0, 64, 64);
    const stream = canvas.captureStream(5);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: BlobPart[] = [];
    const done = new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    });
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 800));
    recorder.stop();
    const video = await done;
    stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await video.arrayBuffer()));
  });
  const original = await upload(
    admin,
    "reel",
    Buffer.from(bytes),
    "video/webm",
    true,
  );
  const reel = await post("reels", {
    title: "Authorized Test Reel",
    description: "A short native video fixture.",
    instagramUrl: "",
    published: true,
    downloadsEnabled: false,
    assetId: original.assetId,
    productIds: [productId, secondId],
  });
  expect((await anon.get(`/api/reels/${reel.id}/download`)).status()).toBe(404);
  await post("reels", {
    id: reel.id,
    title: reel.title,
    description: reel.description,
    instagramUrl: "",
    published: true,
    downloadsEnabled: true,
    assetId: original.assetId,
    productIds: [productId, secondId],
  });
  const download = await anon.get(`/api/reels/${reel.id}/download`);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-disposition"]).toMatch(/attachment/);
  expect((await download.body()).length).toBe(bytes.length);
  const clip = await upload(admin, "product", Buffer.from(bytes), "video/webm");
  await post("products", {
    ...product("Test Solitaire", 10000),
    id: productId,
    mediaIds: [...images, clip.assetId],
  });
  await page.goto("/products/test-solitaire");
  await page.getByRole("button", { name: "View video 1", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Open video in fullscreen viewer",
      exact: true,
    })
    .click();
  await page
    .locator(".product-detail video")
    .evaluate(async (video: HTMLVideoElement) => {
      await video.play();
    });
  await expect
    .poll(() =>
      page
        .locator(".product-detail video")
        .evaluate((video: HTMLVideoElement) => video.readyState),
    )
    .toBeGreaterThan(2);
  await page
    .locator(".product-detail video")
    .evaluate((video: HTMLVideoElement) => video.pause());
  await page.goto("/reels");
  await expect(
    page.getByRole("heading", { name: "Authorized Test Reel" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download Video" }),
  ).toBeVisible();
  await page
    .locator(".reel-video video")
    .evaluate(async (video: HTMLVideoElement) => {
      await video.play();
    });
  await expect
    .poll(() =>
      page
        .locator(".reel-video video")
        .evaluate((video: HTMLVideoElement) => video.readyState),
    )
    .toBeGreaterThan(2);
  await page
    .locator(".reel-video video")
    .evaluate((video: HTMLVideoElement) => video.pause());
  const invalid = await admin.post("/api/admin/reels", {
    data: {
      title: "URL-only Reel",
      description: "",
      instagramUrl: "https://www.instagram.com/reel/owner-provided-link/",
      published: true,
      downloadsEnabled: true,
      assetId: null,
      productIds: [],
    },
  });
  expect(invalid.status()).toBe(400);
  await loginPage(page);
  await page.getByRole("button", { name: "Reels", exact: true }).click();
  await page.getByRole("button", { name: "Add Reel", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Browser Reel Draft");
  await page.getByLabel("Upload file", { exact: true }).setInputFiles({
    name: "browser-clip.webm",
    mimeType: "video/webm",
    buffer: Buffer.from(bytes),
  });
  await page
    .getByRole("button", { name: "Upload selected file", exact: true })
    .click();
  await expect(page.getByText("File ready", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save content", exact: true }).click();
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
  expect(
    await database.reel.count({
      where: { title: "Browser Reel Draft", published: false },
    }),
  ).toBe(1);
});

test("settings persistence, product policy overrides, optional sections and admin editing", async ({
  page,
}) => {
  await post("settings", {
    ...defaults,
    policies: {
      ...defaults.policies,
      payment: "Owner-approved test payment information.",
      returns: "Owner-approved test return information.",
    },
  });
  await page.goto("/products/test-solitaire");
  await page
    .getByRole("button", { name: "Payment Methods", exact: true })
    .click();
  await expect(
    page.getByText("Owner-approved test payment information.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Installment / Layaway Options",
      exact: true,
    }),
  ).toHaveCount(0);
  await loginPage(page);
  await page.getByRole("button", { name: "Products", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Test Solitaire", exact: true })
    .click();
  await page
    .getByLabel("Other Details", { exact: true })
    .fill("An owner-edited product detail.");
  await page
    .getByLabel("Payment method details", { exact: true })
    .fill("Product-specific approved payment information.");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
  await page.goto("/products/test-solitaire");
  await expect(
    page.getByText("An owner-edited product detail.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Payment Methods", exact: true })
    .click();
  await expect(
    page.getByText("Product-specific approved payment information.", {
      exact: true,
    }),
  ).toBeVisible();
  await post("settings", defaults);
});

test("unconfigured Cloudflare fails honestly and does not fabricate uploaded videos", async () => {
  const before = await database.mediaAsset.count();
  const result = await admin.post("/api/uploads", {
    data: {
      action: "authorize",
      purpose: "live",
      provider: "stream",
      filename: "four-hour-recording.mp4",
      mime: "video/mp4",
      bytes: 4000000000,
      duration: 14400,
    },
  });
  expect(result.status()).toBe(503);
  expect((await result.json()).error).toMatch(/not configured/);
  expect(await database.mediaAsset.count()).toBe(before);
  expect(
    (
      await anon.post("/api/stream/webhook", { data: { uid: "fake" } })
    ).status(),
  ).toBe(503);
});

test("production text, mobile layouts, navigation and published-only sitemap", async ({
  page,
}) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/showroom",
      "/products/test-solitaire",
      "/book-a-viewing",
      "/customization",
      "/live-selling",
      "/reels",
      "/contact",
      "/about",
      "/admin/login",
    ]) {
      await page.goto(route);
      await expect(page.locator("body")).not.toContainText(
        /DEMO PREVIEW|sample price|browser-local demo|coming soon|prototype/i,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${width}px ${route}`,
      ).toBeTruthy();
    }
  }
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Timeless Sparkle\. Made to Be Yours/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Custom-Made. Exclusively Yours", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Create Your Own Kind of Sparkle.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Experience the Sparkle Beyond the Screen",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Find your Sparkle", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Handpicked Favorites", exact: true }),
  ).toBeVisible();
  const iconHrefs = await page
    .locator('link[rel="icon"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(iconHrefs.length).toBeGreaterThan(0);
  expect(iconHrefs.join(" ")).not.toContain("/icon.svg");
  await page.getByRole("button", { name: "Open menu" }).click();
  expect(
    await page.locator("nav").getByRole("link").allTextContents(),
  ).toEqual([
    "Home",
    "Showroom",
    "Live Selling",
    "Customization",
    "Book a Viewing",
    "Reels",
    "Stories of Sparkle",
    "About",
    "Contact",
  ]);
  await page
    .locator("nav")
    .getByRole("link", { name: "Live Selling", exact: true })
    .click();
  await expect(page).toHaveURL(/live-selling/);
  await page.goto("/customization");
  await expect(
    page.getByRole("heading", {
      name: "Create Your Own Kind of Sparkle.",
      exact: true,
    }),
  ).toBeVisible();
  const sitemap = await anon.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("/showroom");
  expect(await sitemap.text()).not.toContain("/shop");
  expect(await sitemap.text()).toContain("/stories-of-sparkle");
  expect(await sitemap.text()).toContain("/products/test-solitaire");
  expect(await sitemap.text()).not.toContain("private-draft-ring");
});

test("login attempts are rate limited in the database", async () => {
  for (let i = 0; i < 8; i++)
    expect(
      (
        await anon.post("/api/auth/login", {
          data: { email, password: "not-correct" },
        })
      ).status(),
    ).toBe(401);
  expect(
    (
      await anon.post("/api/auth/login", {
        data: { email, password: "not-correct" },
      })
    ).status(),
  ).toBe(429);
});

test("customer calendar booking persists after review with optional notes", async ({
  page,
}) => {
  const date = manilaDate(new Date(Date.now() + 86400000));
  const startsAt = `${date}T16:30:00+08:00`;
  await post("slots", { startsAt, capacity: 1, enabled: true });
  await page.goto(`/book-a-viewing?product=${productId}`);
  if (!(await page.getByRole("button", { name: date, exact: true }).count()))
    await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(
    page.getByRole("button", { name: date, exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: date, exact: true }).click();
  await page
    .getByRole("button", { name: manilaLabel(startsAt), exact: true })
    .click();
  await page.getByLabel("Customer name").fill("Calendar Customer");
  await page.getByLabel("Email address").fill("calendar@example.invalid");
  await page.getByLabel("Contact number").fill("+639171234567");
  await page.getByRole("button", { name: "Review my request" }).click();
  await expect(
    page.getByRole("heading", { name: "Review your request" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Submit viewing request" }).click();
  await expect(
    page.getByText("Your viewing request has been submitted.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    await database.appointment.count({
      where: {
        email: "calendar@example.invalid",
        productId,
        status: "Pending",
      },
    }),
  ).toBe(1);
});

test("branding upload, publication-aware access and referenced file deletion protection", async () => {
  const asset = await upload(
    admin,
    "branding",
    await readFile("public/ring.jpg"),
  );
  expect(
    (
      await anon.get(`/api/media/${asset.assetId}`, { maxRedirects: 0 })
    ).status(),
  ).toBe(404);
  await post("settings", { ...defaults, logo: `/api/media/${asset.assetId}` });
  expect((await anon.get(`/api/media/${asset.assetId}`)).status()).toBe(200);
  expect(
    (
      await admin.post("/api/uploads", {
        data: { action: "delete", id: asset.assetId },
      })
    ).status(),
  ).toBe(409);
  await post("settings", defaults);
  expect(
    (
      await anon.get(`/api/media/${asset.assetId}`, { maxRedirects: 0 })
    ).status(),
  ).toBe(404);
  expect(
    (
      await admin.post("/api/uploads", {
        data: { action: "delete", id: asset.assetId },
      })
    ).status(),
  ).toBe(200);
  expect(
    await database.mediaAsset.findUnique({ where: { id: asset.assetId } }),
  ).toBeNull();
});

test("unsupported upload contents and forged attachment tokens are rejected", async () => {
  const buffer = Buffer.from("not a JPEG file");
  const authorized = await admin.post("/api/uploads", {
    data: {
      action: "authorize",
      purpose: "product",
      provider: "object",
      filename: "spoof.jpg",
      mime: "image/jpeg",
      bytes: buffer.length,
    },
  });
  const auth = (await authorized.json()) as Upload;
  await admin.put(auth.url, {
    data: buffer,
    headers: { "Content-Type": "image/jpeg" },
  });
  expect(
    (
      await admin.post("/api/uploads", {
        data: { action: "finish", id: auth.assetId },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await database.mediaAsset.findUniqueOrThrow({
        where: { id: auth.assetId },
      })
    ).state,
  ).toBe("failed");
  const reference = await upload(
    anon,
    "custom",
    await readFile("public/ring.jpg"),
  );
  const response = await anon.post("/api/requests/custom", {
    data: {
      name: "Invalid Attachment",
      email: "invalid@example.invalid",
      mobile: "+639171234567",
      message: "A description with a forged upload token.",
      jewelry: "Ring",
      references: [
        { id: reference.assetId, token: "not-the-authorized-token-value" },
      ],
      submissionKey: randomUUID(),
    },
  });
  expect(response.status()).toBe(400);
  expect(
    await database.customizationRequest.count({
      where: { email: "invalid@example.invalid" },
    }),
  ).toBe(0);
});

test("certificate details are optional and authenticity claims require approved text", async () => {
  const file = await upload(
    admin,
    "certificate",
    await readFile("public/ring.jpg"),
  );
  const payload = {
    ...product("Test Solitaire", 10000),
    id: productId,
    certificateId: file.assetId,
    certificateType: "Test-only certificate",
    certificateIssuer: "Test Issuer",
    certificateNumber: "TEST-123",
  };
  await post("products", payload);
  const saved = (await (await admin.get("/api/admin/data")).json()).products.find(
    (item: { id: string }) => item.id === productId,
  );
  expect(saved).toEqual(
    expect.objectContaining({
      certificateType: "Test-only certificate",
      certificateNumber: "TEST-123",
      certificateIssuer: "Test Issuer",
      certificateId: file.assetId,
    }),
  );
  const printed = await (await admin.get(`/admin/print?ids=${productId}`)).text();
  expect(printed).toContain("Authenticity and certificate");
  expect(printed).toContain("TEST-123");
  const invalid = await admin.post("/api/admin/products", {
    data: { ...payload, authenticityEnabled: true, authenticityText: "" },
  });
  expect(invalid.status()).toBe(400);
  await post("products", {
    ...payload,
    authenticityEnabled: true,
    authenticityText: "Owner-approved test-only authenticity statement.",
  });
  const finalPrint = await (await admin.get(`/admin/print?ids=${productId}`)).text();
  expect(finalPrint).toContain(
    "Owner-approved test-only authenticity statement.",
  );
});

test("archiving removes a product from details and shared public listings", async ({
  page,
}) => {
  await post("reels", {
    title: "Archive association fixture",
    description: "",
    instagramUrl: defaults.instagram,
    published: true,
    downloadsEnabled: false,
    assetId: null,
    productIds: [productId, secondId],
  });
  await page.goto("/products/test-trilogy");
  await page
    .getByRole("button", { name: "Save to wishlist", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Wishlist, 1 pieces" }),
  ).toBeVisible();
  expect(
    (
      await admin.delete("/api/admin/products", { data: { id: secondId } })
    ).status(),
  ).toBe(200);
  expect((await anon.get("/products/test-trilogy")).status()).toBe(404);
  const catalog = await (await anon.get("/api/catalog")).json();
  expect(
    catalog.products.some((row: { id: string }) => row.id === secondId),
  ).toBeFalsy();
  await page.goto("/reels");
  await expect(
    page.getByRole("link", { name: "Wishlist, 0 pieces" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".reel-products")
      .getByRole("heading", { name: "Test Trilogy", exact: true }),
  ).toHaveCount(0);
  expect(
    (await database.product.findUniqueOrThrow({ where: { id: secondId } }))
      .archived,
  ).toBeTruthy();
});
