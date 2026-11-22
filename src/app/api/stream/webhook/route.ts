import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { failure, HttpError, json } from "@/lib/security";
import { videoProvider } from "@/lib/media";
export async function POST(req: Request) {
  try {
    const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
    if (!secret) throw new HttpError(503, "Webhook is not configured.");
    const raw = await req.text();
    if (raw.length > 100000) throw new HttpError(413, "Request too large.");
    const parts = Object.fromEntries(
      (req.headers.get("Webhook-Signature") || "")
        .split(",")
        .map((s) => s.trim().split("=")),
    );
    if (
      !parts.time ||
      !parts.sig1 ||
      Math.abs(Date.now() / 1000 - Number(parts.time)) > 300
    )
      throw new HttpError(403, "Invalid signature.");
    const expected = createHmac("sha256", secret)
      .update(`${parts.time}.${raw}`)
      .digest();
    const actual = Buffer.from(parts.sig1, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new HttpError(403, "Invalid signature.");
    const { uid } = z.object({ uid: z.string() }).parse(JSON.parse(raw));
    const asset = await db.mediaAsset.findUnique({ where: { key: uid } });
    if (asset && asset.provider === "stream")
      await videoProvider.inspect(asset);
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
