import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "./db";
import { HttpError } from "./security";
import type { MediaAsset } from "@prisma/client";
import sharp from "sharp";
import { publicProductWhere } from "./public-products";
function storage(publicAccess = false) {
  if (
    !process.env.S3_ENDPOINT ||
    !process.env.S3_ACCESS_KEY_ID ||
    !process.env.S3_SECRET_ACCESS_KEY ||
    !process.env.S3_BUCKET
  )
    throw new HttpError(
      503,
      "File storage is not configured. Please contact the business directly.",
    );
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint:
      publicAccess && process.env.S3_PUBLIC_ENDPOINT
        ? process.env.S3_PUBLIC_ENDPOINT
        : process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}
export async function uploadUrl(key: string, mime: string, bytes: number) {
  return getSignedUrl(
    storage(true),
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: mime,
      ContentLength: bytes,
    }),
    { expiresIn: 900 },
  );
}
export async function objectUrl(
  asset: MediaAsset,
  download = false,
  thumbnail = false,
) {
  return getSignedUrl(
    storage(true),
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: download
        ? asset.key
        : thumbnail && asset.thumbnailKey
          ? asset.thumbnailKey
          : asset.displayKey || asset.key,
      ResponseContentDisposition: download
        ? `attachment; filename="${asset.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`
        : undefined,
    }),
    { expiresIn: 300 },
  );
}
export async function optimizeImage(asset: MediaAsset) {
  if (asset.kind !== "image") return {};
  const client = storage();
  const response = await client.send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: asset.key }),
  );
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) throw new HttpError(400, "Image could not be decoded.");
  const original = sharp(Buffer.from(bytes), {
    limitInputPixels: 40000000,
  }).rotate();
  const display = await original
    .clone()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 86 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await original
    .clone()
    .resize({
      width: 480,
      height: 480,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
  const displayKey = `${asset.key}/display.webp`,
    thumbnailKey = `${asset.key}/thumbnail.webp`;
  await Promise.all([
    client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: displayKey,
        ContentType: "image/webp",
        Body: display.data,
      }),
    ),
    client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: thumbnailKey,
        ContentType: "image/webp",
        Body: thumb,
      }),
    ),
  ]);
  return {
    displayKey,
    thumbnailKey,
    width: display.info.width,
    height: display.info.height,
  };
}
export async function verifyObject(asset: MediaAsset) {
  const client = storage();
  const info = await client.send(
    new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: asset.key }),
  );
  if (
    BigInt(info.ContentLength || 0) !== asset.bytes ||
    info.ContentType !== asset.mime
  )
    throw new HttpError(
      400,
      "Uploaded file does not match the authorized size or format.",
    );
  const response = await client.send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: asset.key,
      Range: "bytes=0-31",
    }),
  );
  const bytes = await response.Body?.transformToByteArray();
  const b = Buffer.from(bytes || []);
  const valid =
    asset.mime === "image/jpeg"
      ? b[0] === 255 && b[1] === 216
      : asset.mime === "image/png"
        ? b
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : asset.mime === "image/webp"
          ? b.toString("ascii", 0, 4) === "RIFF" &&
            b.toString("ascii", 8, 12) === "WEBP"
          : asset.mime === "application/pdf"
            ? b.toString("ascii", 0, 5) === "%PDF-"
            : asset.mime === "video/mp4"
              ? b.toString("ascii", 4, 8) === "ftyp"
              : asset.mime === "video/webm"
                ? b.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))
                : false;
  if (!valid)
    throw new HttpError(
      400,
      "The file contents do not match a supported format.",
    );
}
export async function streamCall(path: string, init: RequestInit = {}) {
  if (
    !process.env.CLOUDFLARE_ACCOUNT_ID ||
    !process.env.CLOUDFLARE_STREAM_API_TOKEN
  )
    throw new HttpError(
      503,
      "Cloudflare Stream is not configured. Video uploads are unavailable until the account is connected.",
    );
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
        ...init.headers,
      },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    console.error(
      "Stream request failed",
      response.status,
      detail.slice(0, 300),
    );
    throw new HttpError(
      502,
      "The video provider could not complete this request. Check account limits and retry.",
    );
  }
  return response;
}
export async function createStreamUpload(
  bytes: number,
  filename: string,
  duration?: number,
) {
  const limit = Number(process.env.STREAM_MAX_FILE_BYTES || 30000000000);
  if (!Number.isSafeInteger(limit) || limit <= 0)
    throw new HttpError(
      503,
      "The Stream upload size configuration is invalid.",
    );
  if (bytes > limit)
    throw new HttpError(
      400,
      "This file exceeds the configured Stream account upload size.",
    );
  const maxDuration = Math.min(
    36000,
    Number(process.env.STREAM_MAX_DURATION_SECONDS || 21600),
  );
  if (!Number.isFinite(maxDuration) || maxDuration <= 0)
    throw new HttpError(
      503,
      "The Stream duration reservation configuration is invalid.",
    );
  const reservation = duration ?? maxDuration;
  if (reservation > maxDuration)
    throw new HttpError(
      400,
      "This recording exceeds the configured provider duration reservation.",
    );
  const metadata = {
    name: filename,
    maxDurationSeconds: String(
      Math.min(maxDuration, Math.ceil(reservation) + 30),
    ),
    expiry: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  };
  const response = await streamCall("?direct_user=true", {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(bytes),
      "Upload-Metadata":
        Object.entries(metadata)
          .map(([k, v]) => `${k} ${Buffer.from(v).toString("base64")}`)
          .join(",") + ",requiresignedurls",
    },
  });
  const url = response.headers.get("Location");
  const uid = response.headers.get("stream-media-id");
  if (!url || !uid)
    throw new HttpError(
      502,
      "Video provider did not return a usable upload authorization.",
    );
  return { url, uid };
}
export async function syncStream(asset: MediaAsset) {
  const res = await streamCall(`/${asset.key}`);
  const { result } = await res.json();
  if (!result || typeof result.readyToStream !== "boolean")
    throw new HttpError(
      502,
      "The video provider returned an incomplete processing status. Retry the status check.",
    );
  const state = result.readyToStream
    ? "ready"
    : result.status?.state === "error"
      ? "failed"
      : result.status?.state === "pendingupload"
        ? "uploading"
        : "processing";
  return db.mediaAsset.update({
    where: { id: asset.id },
    data: {
      state,
      duration: result.duration || null,
      error:
        state === "failed"
          ? "The video provider could not process this file."
          : null,
    },
  });
}
export async function streamPlayer(asset: MediaAsset) {
  if (asset.state !== "ready")
    throw new HttpError(409, "The video is still processing.");
  const response = await streamCall(`/${asset.key}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 21600 }),
  });
  const { result } = await response.json();
  if (!result?.token || typeof result.token !== "string")
    throw new HttpError(
      502,
      "Playback authorization is temporarily unavailable.",
    );
  const delivery = process.env.CLOUDFLARE_STREAM_DELIVERY_HOST;
  if (delivery) {
    if (!/^customer-[a-z0-9-]+\.cloudflarestream\.com$/i.test(delivery))
      throw new HttpError(
        503,
        "The Stream delivery host configuration is invalid.",
      );
    return `https://${delivery}/${result.token}/iframe`;
  }
  return `https://iframe.videodelivery.net/${result.token}`;
}
export async function deleteMedia(asset: MediaAsset) {
  if (asset.provider === "demo") {
    await db.mediaAsset.delete({ where: { id: asset.id } });
    return;
  }
  if (asset.provider === "stream") await videoProvider.remove(asset);
  else
    await Promise.all(
      [asset.key, asset.displayKey, asset.thumbnailKey]
        .filter((key): key is string => Boolean(key))
        .map((Key) =>
          storage().send(
            new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key }),
          ),
        ),
    );
  await db.mediaAsset.delete({ where: { id: asset.id } });
}
export async function isMediaPublic(id: string) {
  const settings = await db.websiteSettings.findUnique({
    where: { id: "main" },
    select: { data: true },
  });
  if ((settings?.data as { logo?: string } | null)?.logo === `/api/media/${id}`)
    return Boolean(
      await db.mediaAsset.findFirst({
        where: { id, purpose: "branding", kind: "image", state: "ready" },
      }),
    );
  return Boolean(
    (await db.product.findFirst({
      where: {
        ...publicProductWhere(),
        OR: [{ media: { some: { assetId: id } } }, { certificateId: id }],
      },
      select: { id: true },
    })) ||
    (await db.reel.findFirst({
      where: { published: true, assetId: id },
      select: { id: true },
    })) ||
    (await db.liveSellingSession.findFirst({
      where: {
        published: true,
        OR: [
          { status: "Completed", replayId: id },
          { thumbnailId: id },
          { trailerId: id },
        ],
      },
      select: { id: true },
    })),
  );
}

// Provider boundary: application routes do not need Cloudflare API details.
export interface VideoProvider {
  authorize: (
    bytes: number,
    filename: string,
    duration?: number,
  ) => Promise<{ url: string; uid: string }>;
  inspect: (asset: MediaAsset) => Promise<MediaAsset>;
  player: (asset: MediaAsset) => Promise<string>;
  remove: (asset: MediaAsset) => Promise<void>;
}
export const videoProvider: VideoProvider = {
  authorize: createStreamUpload,
  inspect: syncStream,
  player: streamPlayer,
  remove: async (asset) => {
    await streamCall(`/${asset.key}`, { method: "DELETE" });
  },
};
