import { db } from "@/lib/db";
import { failure, HttpError, json, session } from "@/lib/security";
import { isMediaPublic, objectUrl, videoProvider } from "@/lib/media";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const asset = await db.mediaAsset.findUnique({ where: { id } });
    if (
      !asset ||
      asset.state !== "ready" ||
      (!(await session()) && !(await isMediaPublic(id)))
    )
      throw new HttpError(404, "Media not found.");
    if (asset.provider === "stream")
      return json({ player: await videoProvider.player(asset) });
    if (asset.provider === "demo") {
      if (!/^\/images\/products\/[a-z0-9-]+\.webp$/.test(asset.key))
        throw new HttpError(404, "Media not found.");
      return new Response(null, {
        status: 302,
        headers: {
          Location: asset.key,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: await objectUrl(
          asset,
          false,
          new URL(req.url).searchParams.get("w") === "480",
        ),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
