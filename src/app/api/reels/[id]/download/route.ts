import { db } from "@/lib/db";
import { failure, HttpError } from "@/lib/security";
import { objectUrl } from "@/lib/media";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const reel = await db.reel.findFirst({
      where: { id, published: true, downloadsEnabled: true },
      include: { asset: true },
    });
    if (
      !reel?.asset ||
      reel.asset.provider !== "object" ||
      reel.asset.state !== "ready" ||
      !reel.asset.authorized
    )
      throw new HttpError(404, "Download is not available.");
    return new Response(null, {
      status: 302,
      headers: {
        Location: await objectUrl(reel.asset, true),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
