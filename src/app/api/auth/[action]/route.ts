import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  body,
  checkPassword,
  createSession,
  failure,
  hash,
  HttpError,
  json,
  rateLimit,
  sameOrigin,
} from "@/lib/security";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    sameOrigin(req);
    const { action } = await params;
    if (action === "logout") {
      const token = (await cookies()).get("rk_session")?.value;
      if (token)
        await db.adminSession.deleteMany({ where: { id: hash(token) } });
      (await cookies()).delete("rk_session");
      return json({ ok: true });
    }
    if (action !== "login") throw new HttpError(404, "Not found");
    await rateLimit(req, "login", 8);
    const input = z
      .object({
        email: z.email().max(200),
        password: z.string().min(1).max(200),
      })
      .parse(await body(req));
    const user = await db.adminUser.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    const valid = await checkPassword(
      input.password,
      user?.passwordHash ||
        "scrypt:00000000000000000000000000000000:" + "00".repeat(64),
    );
    if (!user?.active || !valid)
      throw new HttpError(401, "Invalid email or password.");
    await createSession(user.id);
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
