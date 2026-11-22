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
  images: string[];
type Upload = { assetId: string; token: string; url: string };
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
function product(name: string, price: number | null, published = true) {
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
    'TRUNCATE "AdminUser", "Category", "MediaAsset", "WebsiteSettings", "RateLimit", "AppointmentSlot", "BlockedDate", "Inquiry", "CustomizationRequest", "LiveSellingSession", "Reel" CASCADE',
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
  draftId = (await post("products", product("Private Draft Ring", 123, false)))
    .id;
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
  await expect(page.getByText("Ring Size", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Payment Options", exact: true }),
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
    .getByRole("button", { name: "Viewing & Pickup Information", exact: true })
    .click();
  await expect(
    page.getByText(defaults.policies.viewing!, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Product Description", exact: true })
    .click();
  await expect(
    page.locator(".accordion-content").filter({ hasText: "Second paragraph." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ask About This Item", exact: true })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("Inline Customer");
  await page
    .getByLabel("Email or contact number")
    .fill("inline@example.invalid");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Please tell me more about this ring.");
  await page.getByRole("button", { name: "Send product inquiry" }).click();
  await expect(
    page.getByText("Thank you. Your inquiry has been received."),
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
    page.getByRole("link", { name: "Contact on Instagram" }),
  ).toHaveAttribute("href", defaults.instagram);
  await expect(
    page.getByRole("link", { name: "Contact on Facebook" }),
  ).toHaveAttribute("href", defaults.facebook);
  expect(
    (await anon.get("/shop/test-solitaire", { maxRedirects: 0 })).status(),
  ).toBe(308);
});

test("catalog search, derived dual range, inquiry-only pricing, sorting and reset", async ({
  page,
}) => {
  await page.goto("/shop");
  await expect(page.locator(".product-card")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Save Test Solitaire", exact: true })
    .click();
  await page.goto("/wishlist");
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".product-card h3")).toHaveText("Test Solitaire");
  await page.goto("/shop");
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
  await page.goto("/products/test-solitaire");
  await page
    .getByRole("button", { name: "INQUIRE ON THIS ITEM", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Customer name").fill("Modal Customer");
  await page.getByLabel("Email address").fill("modal@example.invalid");
  await page.getByLabel("Contact number").fill("+639171234567");
  await page
    .getByLabel("Message / questions")
    .fill("I would like to arrange a personal inquiry.");
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
  const row = await database.inquiry.findFirstOrThrow({
    where: { submissionKey },
  });
  await post("inquiries", { id: row.id, status: "Contacted" });
  expect(
    (await database.inquiry.findUniqueOrThrow({ where: { id: row.id } }))
      .status,
  ).toBe("Contacted");
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
    .getByRole("button", { name: "Payment Options", exact: true })
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
    .getByLabel("Payment Options", { exact: true })
    .fill("Product-specific approved payment information.");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
  await page.goto("/products/test-solitaire");
  await expect(
    page.getByText("An owner-edited product detail.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Payment Options", exact: true })
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
      "/shop",
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
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .locator("nav")
    .getByRole("link", { name: "Live Selling", exact: true })
    .click();
  await expect(page).toHaveURL(/live-selling/);
  const sitemap = await anon.get("/sitemap.xml");
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

test("certificate details are optional and authenticity claims require approved text", async ({
  page,
}) => {
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
  await page.goto("/products/test-solitaire");
  await expect(
    page.getByRole("heading", { name: "Certificate information" }),
  ).toBeVisible();
  await expect(page.getByText("TEST-123", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View certificate" }),
  ).toHaveAttribute("href", `/api/media/${file.assetId}`);
  const invalid = await admin.post("/api/admin/products", {
    data: { ...payload, authenticityEnabled: true, authenticityText: "" },
  });
  expect(invalid.status()).toBe(400);
  await post("products", {
    ...payload,
    authenticityEnabled: true,
    authenticityText: "Owner-approved test-only authenticity statement.",
  });
  await page.reload();
  await expect(
    page.getByText("Owner-approved test-only authenticity statement.", {
      exact: true,
    }),
  ).toBeVisible();
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
