import {
  test,
  expect,
  request,
  APIRequestContext,
  Page,
} from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { passwordHash } from "../src/lib/security";
const db = new PrismaClient();
const suffix = randomUUID();
const email = `media-${suffix}@example.invalid`,
  password = randomBytes(24).toString("hex");
const base = process.env.APP_URL || "http://localhost:3002";
const slug = `mixed-media-${suffix}`;
let categoryId: string, userId: string, client: APIRequestContext, clip: Buffer;
const assetIds = new Set<string>(),
  slugs = [slug, `batch-${suffix}`, `retry-${suffix}`];
let mediaIds: string[] = [];
async function upload(buffer: Buffer, mime: string, name: string) {
  const response = await client.post("/api/uploads", {
    data: {
      action: "authorize",
      purpose: "product",
      provider: "object",
      filename: name,
      mime,
      bytes: buffer.length,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const auth = await response.json();
  assetIds.add(auth.assetId);
  expect(
    (
      await client.put(auth.url, {
        headers: { "Content-Type": mime },
        data: buffer,
      })
    ).ok(),
  ).toBeTruthy();
  const ready = await client.post("/api/uploads", {
    data: { action: "finish", id: auth.assetId, token: auth.token },
  });
  expect(ready.ok(), await ready.text()).toBeTruthy();
  return auth.assetId as string;
}
async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
}
test.beforeAll(async ({ browser }) => {
  if (!new URL(process.env.DATABASE_URL || "").pathname.endsWith("_test"))
    throw Error("Product media tests require an isolated _test database.");
  categoryId = (
    await db.category.create({
      data: { name: `Media ${suffix}`, slug: `media-${suffix}` },
    })
  ).id;
  userId = (
    await db.adminUser.create({
      data: { email, passwordHash: await passwordHash(password) },
    })
  ).id;
  client = await request.newContext({
    baseURL: base,
    extraHTTPHeaders: { Origin: base },
  });
  expect(
    (await client.post("/api/auth/login", { data: { email, password } })).ok(),
  ).toBeTruthy();
  const page = await browser.newPage();
  await page.goto(base);
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    let frame = 0;
    const paint = () => {
      ctx.fillStyle = frame++ % 2 ? "#c9973b" : "#e8c68b";
      ctx.fillRect(0, 0, 96, 96);
    };
    paint();
    const stream = canvas.captureStream(10),
      recorder = new MediaRecorder(stream, { mimeType: "video/webm" }),
      chunks: BlobPart[] = [];
    const done = new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    });
    const timer = setInterval(paint, 100);
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 6500));
    recorder.stop();
    const blob = await done;
    clearInterval(timer);
    stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  clip = Buffer.from(bytes);
  await page.close();
  mediaIds = [
    await upload(
      await readFile("public/images/products/solitaire-diamond-ring.webp"),
      "image/webp",
      `first-${suffix}.webp`,
    ),
    await upload(clip, "video/webm", `clip-${suffix}.webm`),
    await upload(
      await readFile("public/images/products/emerald-gemstone-ring.webp"),
      "image/webp",
      `last-${suffix}.webp`,
    ),
  ];
  const created = await client.post("/api/admin/products", {
    data: {
      name: "Mixed Media Test",
      slug,
      categoryId,
      price: null,
      description: "Isolated media behavior test.",
      availability: "Available",
      published: true,
      ownerConfirmed: true,
      mediaIds,
      specifications: {},
      policies: {},
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
});
test.afterAll(async () => {
  await db.product.deleteMany({ where: { slug: { in: slugs } } });
  for (const id of assetIds) {
    try {
      await client.post("/api/uploads", { data: { action: "delete", id } });
    } catch {
      /* A failed test can leave an unattached upload for the test bucket lifecycle cleanup. */
    }
  }
  if (userId) await db.adminUser.delete({ where: { id: userId } });
  if (categoryId) await db.category.delete({ where: { id: categoryId } });
  await client?.dispose();
  await db.$disconnect();
});

async function batch(page: Page, retry = false) {
  await signIn(page);
  page.on("response", (response) => {
    if (
      response.url().endsWith("/api/uploads") &&
      response.request().method() === "POST"
    ) {
      const input = response.request().postDataJSON();
      if (input?.action === "authorize")
        void response
          .json()
          .then((body) => {
            if (body.assetId) assetIds.add(body.assetId);
          })
          .catch(() => {});
    }
  });
  await page.getByRole("button", { name: "Products", exact: true }).click();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page
    .getByLabel("Product name", { exact: true })
    .fill(retry ? "Retry Batch Test" : "Batch Media Test");
  await page
    .getByLabel("URL slug", { exact: true })
    .fill(retry ? `retry-${suffix}` : `batch-${suffix}`);
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption(categoryId);
  await page
    .getByLabel("Payment method details", { exact: true })
    .fill("Approved product payment method details.");
  let failed = false;
  if (retry)
    await page.route("**/api/uploads", async (route) => {
      const input = route.request().postDataJSON();
      if (input?.action === "finish" && !failed) {
        failed = true;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Injected transient completion failure; retry this file.",
          }),
        });
        return;
      }
      await route.continue();
    });
  const picker = page.getByLabel("Add photos and videos", { exact: true });
  await expect(picker).toHaveAttribute("multiple", "");
  await picker.setInputFiles([
    {
      name: `batch-first-${suffix}.webp`,
      mimeType: "image/webp",
      buffer: await readFile(
        "public/images/products/solitaire-diamond-ring.webp",
      ),
    },
    {
      name: `batch-video-${suffix}.webm`,
      mimeType: "video/webm",
      buffer: clip,
    },
    {
      name: `batch-last-${suffix}.webp`,
      mimeType: "image/webp",
      buffer: await readFile(
        "public/images/products/emerald-gemstone-ring.webp",
      ),
    },
  ]);
  await expect(page.locator(".upload-queue-item")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Save product", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Upload 3 files", exact: true })
    .click();
  if (retry) {
    await expect(
      page.locator(".upload-queue-item[data-upload-state=ready]"),
    ).toHaveCount(2);
    await expect(
      page.locator(".upload-queue-item[data-upload-state=failed]"),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Save product", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Retry file", exact: true }).click();
  }
  await expect(
    page.locator(".upload-queue-item[data-upload-state=ready]"),
  ).toHaveCount(3);
  await expect(page.locator(".ordered-media-row")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Save product", exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("I confirm this is actual approved inventory", { exact: false })
    .check();
  await page.getByLabel("Publish on the website", { exact: true }).check();
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
  const row = await db.product.findUniqueOrThrow({
    where: { slug: retry ? `retry-${suffix}` : `batch-${suffix}` },
    include: {
      media: { include: { asset: true }, orderBy: { position: "asc" } },
    },
  });
  expect(row.policies).toMatchObject({
    payment: "Approved product payment method details.",
  });
  expect(row.media.map((item) => item.asset.kind)).toEqual([
    "image",
    "video",
    "image",
  ]);
  expect(row.media[0].asset.filename).toContain("batch-first");
  expect(row.media[2].asset.filename).toContain("batch-last");
  return row;
}

test("admin uploads multiple photos and videos together and persists their mixed order", async ({
  page,
}) => {
  const row = await batch(page);
  await page.goto(`/products/${row.slug}`);
  await expect(
    page.getByRole("button", { name: "View video 1", exact: true }),
  ).toBeVisible();
  const dto = await (await client.get("/api/catalog")).json();
  expect(
    dto.products
      .find((product: { id: string }) => product.id === row.id)
      .media.map((item: { kind: string }) => item.kind),
  ).toEqual(["image", "video", "image"]);
});
test("a failed upload can be retried without re-uploading successful files or changing the chosen order", async ({
  page,
}) => {
  await batch(page, true);
});
test("photos rotate, videos autoplay muted to completion, and the mixed gallery loops in order", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`/products/${slug}`);
  await page.mouse.move(0, 0);
  const stage = page.locator(".gallery-main");
  await expect(stage).toHaveAttribute("data-media-id", mediaIds[0]);
  await expect(stage).toHaveAttribute("data-media-id", mediaIds[1], {
    timeout: 9000,
  });
  const video = stage.locator("video");
  await expect
    .poll(() =>
      video.evaluate(
        (element: HTMLVideoElement) => !element.paused && element.muted,
      ),
    )
    .toBeTruthy();
  await page.waitForTimeout(5100);
  await expect(stage).toHaveAttribute("data-media-id", mediaIds[1]);
  await expect(stage).toHaveAttribute("data-media-id", mediaIds[2], {
    timeout: 5000,
  });
  await expect(stage).toHaveAttribute("data-media-id", mediaIds[0], {
    timeout: 8000,
  });
});
test("pause, manual navigation, fullscreen and mobile layout remain usable", async ({
  page,
}) => {
  await page.goto(`/products/${slug}`);
  const stage = page.locator(".gallery-main");
  await page
    .getByRole("button", { name: "Pause slideshow", exact: true })
    .click();
  await page.waitForTimeout(5500);
  await expect(stage).toHaveAttribute("data-media-id", mediaIds[0]);
  await page
    .getByRole("button", { name: "Next image or video", exact: true })
    .click();
  await expect(stage).toHaveAttribute("data-media-kind", "video");
  expect(
    await stage
      .locator("video")
      .evaluate((element: HTMLVideoElement) => element.paused),
  ).toBeTruthy();
  await page.getByRole("button", { name: "View photo 2", exact: true }).click();
  await page.getByRole("button", { name: "Enlarge product image" }).click();
  await page.getByRole("button", { name: "Toggle image zoom" }).click();
  await expect(page.locator(".zoom-surface")).toHaveClass(/zoomed/);
  await page.getByRole("button", { name: "Close fullscreen gallery" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("reduced-motion preference disables automatic rotation until the customer explicitly starts it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat/i.test(message.text()))
      errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/products/${slug}`);
  await expect(
    page.getByRole("button", { name: "Resume slideshow" }),
  ).toBeVisible();
  await page.waitForTimeout(5500);
  await expect(page.locator(".gallery-main")).toHaveAttribute(
    "data-media-id",
    mediaIds[0],
  );
  await page.getByRole("button", { name: "Resume slideshow" }).click();
  await expect(page.locator(".gallery-main")).toHaveAttribute(
    "data-media-id",
    mediaIds[1],
    { timeout: 9000 },
  );
  await page.goto("/");
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
