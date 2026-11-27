import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  body,
  failure,
  hash,
  HttpError,
  json,
  rateLimit,
  requireAdmin,
  sameOrigin,
  session,
} from "@/lib/security";
import {
  videoProvider,
  uploadUrl,
  verifyObject,
  deleteMedia,
  optimizeImage,
} from "@/lib/media";
const schema = z.object({
  action: z.enum(["authorize", "finish", "status", "delete"]),
  id: z.string().optional(),
  token: z.string().optional(),
  provider: z.enum(["object", "stream"]).default("object"),
  purpose: z
    .enum(["product", "certificate", "custom", "reel", "live", "branding"])
    .default("product"),
  filename: z.string().min(1).max(200).optional(),
  mime: z.string().optional(),
  bytes: z.number().int().positive().optional(),
  duration: z.number().positive().optional(),
  authorized: z.boolean().default(false),
});
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const input = schema.parse(await body(req));
    const admin = await session();
    if (input.action === "authorize") {
      if (!admin) {
        if (input.purpose !== "custom" || input.provider !== "object")
          throw new HttpError(401, "Please sign in.");
        await rateLimit(req, "reference-upload", 12, 3600);
      }
      const { filename, mime, bytes } = input;
      if (!filename || !mime || !bytes)
        throw new HttpError(400, "Select a valid file.");
      const image = ["image/jpeg", "image/png", "image/webp"];
      const video = ["video/mp4", "video/webm"];
      const allowed =
        input.purpose === "certificate"
          ? [...image, "application/pdf"]
          : input.purpose === "custom" || input.purpose === "branding"
            ? image
            : input.provider === "stream" || input.purpose === "reel"
              ? video
              : [...image, ...video];
      if (!allowed.includes(mime))
        throw new HttpError(
          400,
          "Unsupported file format. Use JPEG, PNG, WebP, PDF certificates, or MP4/WebM video.",
        );
      if (input.provider === "stream") {
        const upload = await videoProvider.authorize(
          bytes,
          filename,
          input.duration,
        );
        const asset = await db.mediaAsset.create({
          data: {
            provider: "stream",
            purpose: input.purpose,
            kind: "video",
            key: upload.uid,
            filename,
            mime,
            bytes: BigInt(bytes),
            authorized: input.authorized,
          },
        });
        return json({ assetId: asset.id, url: upload.url, provider: "stream" });
      }
      const limit = video.includes(mime)
        ? Number(process.env.REEL_MAX_FILE_BYTES || 536870912)
        : Number(process.env.IMAGE_MAX_FILE_BYTES || 20971520);
      if (!Number.isSafeInteger(limit) || limit <= 0)
        throw new HttpError(
          503,
          "The file upload size configuration is invalid.",
        );
      if (bytes > limit)
        throw new HttpError(
          400,
          "This file exceeds the configured upload size. Use Stream for long video recordings.",
        );
      const key = `${input.purpose}/${randomUUID()}`;
      const url = await uploadUrl(key, mime, bytes);
      const token = randomBytes(32).toString("base64url");
      const asset = await db.mediaAsset.create({
        data: {
          provider: "object",
          purpose: input.purpose,
          kind: video.includes(mime)
            ? "video"
            : mime === "application/pdf"
              ? "document"
              : "image",
          key,
          filename,
          mime,
          bytes: BigInt(bytes),
          authorized: input.authorized,
          uploadTokenHash: hash(token),
          uploadExpiresAt: new Date(Date.now() + 2 * 3600000),
        },
      });
      return json({ assetId: asset.id, url, token, provider: "object" });
    }
    const asset = await db.mediaAsset.findUnique({
      where: { id: input.id || "" },
    });
    if (!asset) throw new HttpError(404, "File not found.");
    if (
      !admin &&
      (!input.token ||
        asset.purpose !== "custom" ||
        asset.uploadTokenHash !== hash(input.token) ||
        !asset.uploadExpiresAt ||
        asset.uploadExpiresAt < new Date())
    )
      throw new HttpError(
        403,
        "Upload authorization expired. Please select the file again.",
      );
    if (input.action === "delete") {
      await requireAdmin(req);
      const attached =
        ((await getSettings()).logo === `/api/media/${asset.id}` ? 1 : 0) +
        (await db.productMedia.count({ where: { assetId: asset.id } })) +
        (await db.product.count({ where: { certificateId: asset.id } })) +
        (await db.customReference.count({ where: { assetId: asset.id } })) +
        (await db.reel.count({ where: { assetId: asset.id } })) +
        (await db.liveSellingSession.count({
          where: {
            OR: [
              { replayId: asset.id },
              { thumbnailId: asset.id },
              { trailerId: asset.id },
            ],
          },
        }));
      if (attached)
        throw new HttpError(
          409,
          "Detach this file from its content before deleting it.",
        );
      await deleteMedia(asset);
      return json({ ok: true });
    }
    if (asset.provider === "stream") {
      await requireAdmin(req);
      return json(await videoProvider.inspect(asset));
    }
    if (input.action === "finish") {
      if (asset.state === "ready")
        return json({ id: asset.id, state: asset.state });
      try {
        await verifyObject(asset);
        const optimized = await optimizeImage(asset);
        const ready = await db.mediaAsset.update({
          where: { id: asset.id },
          data: { state: "ready", error: null, ...optimized },
        });
        return json({ id: ready.id, state: ready.state });
      } catch (error) {
        await db.mediaAsset.update({
          where: { id: asset.id },
          data: {
            state: "failed",
            error:
              error instanceof HttpError
                ? error.message
                : "The file could not be verified or processed. Retry the upload or choose a replacement.",
          },
        });
        throw error;
      }
    }
    return json({ id: asset.id, state: asset.state });
  } catch (e) {
    return failure(e);
  }
}
