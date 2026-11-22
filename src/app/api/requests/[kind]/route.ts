import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  body,
  failure,
  hash,
  HttpError,
  json,
  rateLimit,
  sameOrigin,
} from "@/lib/security";
import { inquirySchema, bookingSchema, customSchema } from "@/lib/validation";
import { getSettings } from "@/lib/settings";
import { manilaDate } from "@/lib/manila";
import { checkSpam } from "@/lib/submissions";
import { publicProductWhere } from "@/lib/public-products";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  try {
    sameOrigin(req);
    await rateLimit(req, "public-form", 12);
    const { kind } = await params;
    const raw = await body(req);
    const schema =
      kind === "inquiry"
        ? inquirySchema
        : kind === "viewing"
          ? bookingSchema
          : kind === "custom"
            ? customSchema
            : null;
    if (!schema) throw new HttpError(404, "Not found.");
    const data = schema.parse(raw);
    const payloadHash = hash(JSON.stringify(data));
    const existing =
      kind === "inquiry"
        ? await db.inquiry.findUnique({
            where: { submissionKey: data.submissionKey },
          })
        : kind === "viewing"
          ? await db.appointment.findUnique({
              where: { submissionKey: data.submissionKey },
            })
          : await db.customizationRequest.findUnique({
              where: { submissionKey: data.submissionKey },
            });
    if (existing) {
      if (existing.payloadHash !== payloadHash)
        throw new HttpError(
          409,
          "The submission has changed. Please refresh and retry.",
        );
      return json({ id: existing.id });
    }
    await checkSpam(data.turnstileToken);
    if (
      "productId" in data &&
      data.productId &&
      !(await db.product.findFirst({
        where: { ...publicProductWhere(), id: data.productId },
        select: { id: true },
      }))
    )
      throw new HttpError(
        400,
        "This jewelry piece is no longer available for online inquiry.",
      );
    const contact = {
      name: data.name,
      email: data.email,
      mobile: data.mobile,
      message: data.message,
      submissionKey: data.submissionKey,
      payloadHash,
    };
    if (kind === "inquiry") {
      const input = inquirySchema.parse(data);
      if (input.platform === "Email" && !(await getSettings()).email)
        throw new HttpError(400, "Email contact is not configured.");
      const row = await db.inquiry.create({
        data: {
          ...contact,
          platform: input.platform,
          productId: input.productId,
        },
      });
      return json({ id: row.id }, 201);
    }
    if (kind === "viewing") {
      const input = bookingSchema.parse(data);
      const settings = await getSettings();
      if (
        ![settings.location, settings.meetup]
          .filter(Boolean)
          .includes(input.location)
      )
        throw new HttpError(
          400,
          "Please choose a configured viewing location.",
        );
      const row = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "AppointmentSlot" WHERE id=${input.slotId} FOR UPDATE`;
        const slot = await tx.appointmentSlot.findUnique({
          where: { id: input.slotId },
        });
        if (
          !slot ||
          !slot.enabled ||
          slot.startsAt <= new Date() ||
          (await tx.blockedDate.findUnique({
            where: { date: manilaDate(slot.startsAt) },
          }))
        )
          throw new HttpError(
            409,
            "This time is not available. Please choose another slot.",
          );
        const count = await tx.appointment.count({
          where: { slotId: slot.id, status: { in: ["Pending", "Confirmed"] } },
        });
        if (count >= slot.capacity)
          throw new HttpError(
            409,
            "This time was just requested. Please choose another slot.",
          );
        return tx.appointment.create({
          data: {
            ...contact,
            email: input.email,
            mobile: input.mobile,
            type: input.type,
            location: input.location,
            slotId: slot.id,
            productId: input.productId,
          },
        });
      });
      return json({ id: row.id }, 201);
    }
    const input = customSchema.parse(data);
    const row = await db.$transaction(async (tx) => {
      for (const file of input.references) {
        const asset = await tx.mediaAsset.findUnique({
          where: { id: file.id },
        });
        if (
          !asset ||
          asset.purpose !== "custom" ||
          asset.state !== "ready" ||
          asset.uploadTokenHash !== hash(file.token) ||
          !asset.uploadExpiresAt ||
          asset.uploadExpiresAt < new Date()
        )
          throw new HttpError(
            400,
            "An image upload has expired. Please select it again.",
          );
        const claimed = await tx.mediaAsset.updateMany({
          where: { id: asset.id, uploadTokenHash: hash(file.token) },
          data: { uploadTokenHash: null, uploadExpiresAt: null },
        });
        if (claimed.count !== 1)
          throw new HttpError(
            409,
            "This reference is already attached to a request.",
          );
      }
      return tx.customizationRequest.create({
        data: {
          ...contact,
          email: input.email,
          mobile: input.mobile,
          jewelry: input.jewelry,
          metal: input.metal,
          gemstone: input.gemstone,
          budget: input.budget,
          references: {
            create: input.references.map((file) => ({ assetId: file.id })),
          },
        },
      });
    });
    return json({ id: row.id }, 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return json(
        {
          error:
            "This request was already submitted. Please refresh before starting another request.",
        },
        409,
      );
    return failure(e);
  }
}
