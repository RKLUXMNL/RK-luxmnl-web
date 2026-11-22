import { z } from "zod";
import { db } from "@/lib/db";
import { body, failure, HttpError, json, requireAdmin } from "@/lib/security";
import { productSchema, liveSchema, reelSchema, id } from "@/lib/validation";
import { getSettings, settingsSchema } from "@/lib/settings";
import { productInclude } from "@/lib/catalog";
import { manilaDate } from "@/lib/manila";
import { demoCatalogEnabled, publicProductWhere } from "@/lib/public-products";
type Context = { params: Promise<{ resource: string }> };
export async function GET(req: Request, { params }: Context) {
  try {
    await requireAdmin();
    const { resource } = await params;
    if (resource !== "data") throw new HttpError(404, "Not found");
    const q = new URL(req.url).searchParams.get("q")?.slice(0, 100) || "";
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .parse(new URL(req.url).searchParams.get("page") || 0);
    const take = 100,
      skip = page * take;
    const search = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { message: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};
    const [
      products,
      categories,
      inquiries,
      appointments,
      customizations,
      slots,
      blocked,
      sessions,
      reels,
      assets,
      settings,
      counts,
    ] = await Promise.all([
      db.product.findMany({
        include: productInclude,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      db.category.findMany({ orderBy: { name: "asc" } }),
      db.inquiry.findMany({
        where: search,
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      db.appointment.findMany({
        where: search,
        include: { slot: true, product: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      db.customizationRequest.findMany({
        where: search,
        include: { references: { include: { asset: true } } },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      db.appointmentSlot.findMany({
        orderBy: { startsAt: "desc" },
        take,
        skip,
      }),
      db.blockedDate.findMany(),
      db.liveSellingSession.findMany({
        include: { replay: true, products: true },
        orderBy: { startsAt: "desc" },
        take,
        skip,
      }),
      db.reel.findMany({
        include: { asset: true, products: true },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      db.mediaAsset.findMany({
        select: {
          id: true,
          filename: true,
          kind: true,
          provider: true,
          purpose: true,
          state: true,
          error: true,
          authorized: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      getSettings(),
      Promise.all([
        db.product.count(),
        db.product.count({ where: publicProductWhere() }),
        db.inquiry.count({ where: { status: "New" } }),
        db.appointment.count({ where: { status: "Pending" } }),
        db.customizationRequest.count(),
        db.liveSellingSession.count({ where: { status: "Completed" } }),
        db.mediaAsset.count({ where: { kind: "video", state: "ready" } }),
      ]),
    ]);
    return json({
      page,
      query: q,
      hasMore: [
        products,
        inquiries,
        appointments,
        customizations,
        slots,
        sessions,
        reels,
        assets,
      ].some((rows) => rows.length === take),
      products,
      categories,
      inquiries,
      appointments,
      customizations,
      slots,
      blocked,
      sessions,
      reels,
      assets,
      settings,
      counts,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request, { params }: Context) {
  try {
    await requireAdmin(req);
    const { resource } = await params;
    const raw = await body(req);
    const recordId = z.object({ id: id.optional() }).parse(raw).id;
    if (resource === "settings") {
      const data = settingsSchema.parse(raw);
      if (data.logo.startsWith("/api/media/")) {
        const assetId = data.logo.split("/").pop();
        if (
          !(await db.mediaAsset.findFirst({
            where: {
              id: assetId,
              purpose: "branding",
              kind: "image",
              state: "ready",
            },
          }))
        )
          throw new HttpError(400, "Select a ready business logo image.");
      }
      return json(
        await db.websiteSettings.upsert({
          where: { id: "main" },
          create: { id: "main", data },
          update: { data },
        }),
      );
    }
    if (resource === "categories") {
      const data = z
        .object({
          name: z.string().trim().min(1).max(100),
          slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        })
        .parse(raw);
      return json(
        recordId
          ? await db.category.update({ where: { id: recordId }, data })
          : await db.category.create({ data }),
      );
    }
    if (resource === "products") {
      const { mediaIds, ...data } = productSchema.parse(raw);
      const existing = recordId
        ? await db.product.findUnique({
            where: { id: recordId },
            select: { isDemo: true },
          })
        : null;
      const demo = existing?.isDemo === true;
      if (new Set(mediaIds).size !== mediaIds.length)
        throw new HttpError(400, "A media file may only appear once.");
      const media = await db.mediaAsset.findMany({
        where: { id: { in: mediaIds }, purpose: "product", state: "ready" },
      });
      if (media.length !== mediaIds.length)
        throw new HttpError(400, "Select only ready product media.");
      if (!demo && media.some((asset) => asset.provider === "demo"))
        throw new HttpError(
          400,
          "Demo imagery is only available for demo products. Upload approved photographs for real inventory.",
        );
      if (demo && data.published && !demoCatalogEnabled())
        throw new HttpError(
          400,
          "Enable the local demo catalog to publish demo products for testing.",
        );
      if (
        data.certificateId &&
        !(await db.mediaAsset.findFirst({
          where: {
            id: data.certificateId,
            purpose: "certificate",
            state: "ready",
          },
        }))
      )
        throw new HttpError(400, "Select a ready certificate file.");
      if (data.authenticityEnabled && !data.authenticityText)
        throw new HttpError(400, "Provide an approved authenticity statement.");
      if (
        data.published &&
        ((!data.ownerConfirmed && !demo) ||
          data.archived ||
          !media.some((m) => m.kind === "image"))
      )
        throw new HttpError(
          400,
          "Publishing requires owner-confirmed information, an active record, and a ready product image.",
        );
      return json(
        await db.$transaction(async (tx) => {
          const product = recordId
            ? await tx.product.update({ where: { id: recordId }, data })
            : await tx.product.create({ data });
          await tx.productMedia.deleteMany({
            where: { productId: product.id },
          });
          await tx.productMedia.createMany({
            data: mediaIds.map((assetId, position) => ({
              productId: product.id,
              assetId,
              position,
            })),
          });
          return product;
        }),
      );
    }
    if (resource === "sessions") {
      const { products, ...data } = liveSchema.parse(raw);
      if (new Set(products.map((p) => p.productId)).size !== products.length)
        throw new HttpError(
          400,
          "Each featured product can only be added once.",
        );
      if (data.replayId) {
        const asset = await db.mediaAsset.findFirst({
          where: { id: data.replayId, provider: "stream", purpose: "live" },
        });
        if (!asset) throw new HttpError(400, "Select a live recording.");
        if (
          data.published &&
          data.status === "Completed" &&
          asset.state !== "ready"
        )
          throw new HttpError(
            400,
            "The replay must finish processing before publication.",
          );
        if (
          asset.duration &&
          products.some(
            (p) => p.timestamp !== null && p.timestamp > asset.duration!,
          )
        )
          throw new HttpError(
            400,
            "A featured-product timestamp exceeds the recording duration.",
          );
      }
      return json(
        await db.$transaction(async (tx) => {
          const value = { ...data, startsAt: new Date(data.startsAt) };
          const row = recordId
            ? await tx.liveSellingSession.update({
                where: { id: recordId },
                data: value,
              })
            : await tx.liveSellingSession.create({ data: value });
          await tx.liveProduct.deleteMany({ where: { sessionId: row.id } });
          await tx.liveProduct.createMany({
            data: products.map((p, position) => ({
              ...p,
              sessionId: row.id,
              position,
            })),
          });
          return row;
        }),
      );
    }
    if (resource === "reels") {
      const { productIds, ...data } = reelSchema.parse(raw);
      const asset = data.assetId
        ? await db.mediaAsset.findFirst({
            where: { id: data.assetId, purpose: "reel", kind: "video" },
          })
        : null;
      if (data.assetId && !asset)
        throw new HttpError(400, "Select a Reel video.");
      if (data.published && !data.instagramUrl && asset?.state !== "ready")
        throw new HttpError(
          400,
          "A published Reel needs a valid Instagram link or a ready video.",
        );
      if (data.assetId && data.published && asset?.state !== "ready")
        throw new HttpError(
          400,
          "The uploaded Reel must be ready before publication.",
        );
      if (
        data.downloadsEnabled &&
        (!asset ||
          asset.provider !== "object" ||
          asset.state !== "ready" ||
          !asset.authorized)
      )
        throw new HttpError(
          400,
          "Downloads require a ready, authorized original video file.",
        );
      return json(
        await db.$transaction(async (tx) => {
          const row = recordId
            ? await tx.reel.update({ where: { id: recordId }, data })
            : await tx.reel.create({ data });
          await tx.reelProduct.deleteMany({ where: { reelId: row.id } });
          await tx.reelProduct.createMany({
            data: [...new Set(productIds)].map((productId) => ({
              productId,
              reelId: row.id,
            })),
          });
          return row;
        }),
      );
    }
    if (resource === "inquiries") {
      const data = z
        .object({ id, status: z.enum(["New", "Contacted", "Closed"]) })
        .parse(raw);
      return json(
        await db.inquiry.update({
          where: { id: data.id },
          data: { status: data.status },
        }),
      );
    }
    if (resource === "customizations") {
      const data = z
        .object({
          id,
          status: z.enum([
            "New",
            "Contacted",
            "In Progress",
            "Completed",
            "Closed",
          ]),
        })
        .parse(raw);
      return json(
        await db.customizationRequest.update({
          where: { id: data.id },
          data: { status: data.status },
        }),
      );
    }
    if (resource === "appointments") {
      const data = z
        .object({
          id,
          status: z.enum(["Pending", "Confirmed", "Completed", "Cancelled"]),
        })
        .parse(raw);
      return json(
        await db.$transaction(async (tx) => {
          const current = await tx.appointment.findUniqueOrThrow({
            where: { id: data.id },
          });
          await tx.$queryRaw`SELECT id FROM "AppointmentSlot" WHERE id=${current.slotId} FOR UPDATE`;
          if (["Pending", "Confirmed"].includes(data.status)) {
            const slot = await tx.appointmentSlot.findUniqueOrThrow({
              where: { id: current.slotId },
            });
            if (
              !slot.enabled ||
              (await tx.blockedDate.findUnique({
                where: { date: manilaDate(slot.startsAt) },
              }))
            )
              throw new HttpError(409, "The date or slot is unavailable.");
            const occupied = await tx.appointment.count({
              where: {
                slotId: slot.id,
                id: { not: data.id },
                status: { in: ["Pending", "Confirmed"] },
              },
            });
            if (occupied >= slot.capacity)
              throw new HttpError(409, "This slot is at capacity.");
          }
          return tx.appointment.update({
            where: { id: data.id },
            data: { status: data.status },
          });
        }),
      );
    }
    if (resource === "slots") {
      const data = z
        .object({
          startsAt: z.iso.datetime({ offset: true }),
          capacity: z.number().int().min(1).max(100),
          enabled: z.boolean(),
        })
        .parse(raw);
      return json(
        await db.$transaction(async (tx) => {
          if (recordId) {
            await tx.$queryRaw`SELECT id FROM "AppointmentSlot" WHERE id=${recordId} FOR UPDATE`;
            const active = await tx.appointment.count({
              where: {
                slotId: recordId,
                status: { in: ["Pending", "Confirmed"] },
              },
            });
            if (active > data.capacity)
              throw new HttpError(
                409,
                "Capacity cannot be lower than existing active requests.",
              );
          }
          return recordId
            ? tx.appointmentSlot.update({
                where: { id: recordId },
                data: { ...data, startsAt: new Date(data.startsAt) },
              })
            : tx.appointmentSlot.create({
                data: { ...data, startsAt: new Date(data.startsAt) },
              });
        }),
      );
    }
    if (resource === "blocked") {
      const data = z
        .object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          reason: z.string().max(500),
        })
        .parse(raw);
      return json(
        await db.blockedDate.upsert({
          where: { date: data.date },
          create: data,
          update: { reason: data.reason },
        }),
      );
    }
    throw new HttpError(404, "Not found");
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request, { params }: Context) {
  try {
    await requireAdmin(req);
    const { resource } = await params;
    const input = z.object({ id }).parse(await body(req));
    if (resource === "products")
      return json(
        await db.product.update({
          where: { id: input.id },
          data: { archived: true, published: false },
        }),
      );
    if (resource === "categories")
      await db.category.delete({ where: { id: input.id } });
    else if (resource === "sessions")
      await db.liveSellingSession.delete({ where: { id: input.id } });
    else if (resource === "reels")
      await db.reel.delete({ where: { id: input.id } });
    else if (resource === "blocked")
      await db.blockedDate.delete({ where: { date: input.id } });
    else if (resource === "slots")
      await db.appointmentSlot.delete({ where: { id: input.id } });
    else throw new HttpError(404, "Not found");
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
