import {
  randomBytes,
  scrypt as derive,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
const scrypt = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    derive(
      password,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt);
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function checkPassword(password: string, encoded: string) {
  const [scheme, salt, key] = encoded.split(":");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const derived = await scrypt(password, salt);
  const stored = Buffer.from(key, "hex");
  return stored.length === derived.length && timingSafeEqual(derived, stored);
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = process.env.APP_URL || new URL(req.url).origin;
  const allowed = new Set([
    new URL(expected).origin,
    ...(process.env.ADDITIONAL_ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => new URL(value).origin),
  ]);
  if (!origin || !allowed.has(origin))
    throw new HttpError(403, "Request origin is not allowed.");
}
export async function readText(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 100000)
    throw new HttpError(413, "Request is too large.");
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 100000) {
        await reader.cancel();
        throw new HttpError(413, "Request is too large.");
      }
      chunks.push(part.value);
    }
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function body(req: Request) {
  const raw = await readText(req);
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}
export async function session() {
  const token = (await cookies()).get("rk_session")?.value;
  if (!token) return null;
  const row = await db.adminSession.findUnique({
    where: { id: hash(token) },
    include: { user: true },
  });
  if (!row || row.expiresAt < new Date() || !row.user.active) return null;
  return { id: row.user.id, email: row.user.email, role: row.user.role };
}
export async function requireAdmin(req?: Request) {
  if (req && req.method !== "GET") sameOrigin(req);
  const user = await session();
  if (!user) throw new HttpError(401, "Please sign in.");
  return user;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await db.adminSession.create({
    data: { id: hash(token), userId, expiresAt },
  });
  (await cookies()).set("rk_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}
export async function rateLimit(
  req: Request,
  scope: string,
  max = 10,
  seconds = 900,
) {
  const ip =
    process.env.TRUST_PROXY === "true"
      ? req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        "unknown"
      : "shared";
  const key = hash(
    `${scope}:${ip.trim()}:${Math.floor(Date.now() / (seconds * 1000))}`,
  );
  const row = await db.rateLimit.upsert({
    where: { key },
    create: { key, expiresAt: new Date(Date.now() + seconds * 1000) },
    update: { count: { increment: 1 } },
  });
  if (row.count > max)
    throw new HttpError(429, "Too many attempts. Please try again later.");
}
export function json(data: unknown, status = 200) {
  return Response.json(
    JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ),
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      400,
    );
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return json(
        { error: "This record already exists. Please refresh and try again." },
        409,
      );
    if (error.code === "P2025")
      return json({ error: "Record not found." }, 404);
    if (error.code === "P2003")
      return json({ error: "This record is still in use." }, 409);
  }
  console.error(
    "Server operation failed",
    error instanceof Error ? error.message : "Unknown error",
  );
  return json(
    { error: "We could not complete this request. Please try again." },
    500,
  );
}
