import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { rkDb?: PrismaClient };
export const db = globalDb.rkDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.rkDb = db;
